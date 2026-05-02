import { Router, json as jsonParser } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
	createMomentumHandlers,
	getMomentumAPI,
	handleAccessRequest,
	handleStatusRequest,
	handleGetGlobalRequest,
	handleUpdateGlobalRequest,
	handleListVersionsRequest,
	handleGetVersionRequest,
	handleRestoreVersionRequest,
	handleCompareVersionsRequest,
	handlePublishRequest,
	handleUnpublishRequest,
	handleSaveDraftRequest,
	handleSchedulePublishRequest,
	handleCancelScheduledPublishRequest,
	handleBatchRequest,
	handleGraphQLPostRequest,
	handleGraphQLGetRequest,
	handleUpload,
	handleCollectionUpload,
	handleFileGet,
	getUploadConfig,
	buildGraphQLSchema,
	generateOpenAPISpec,
	getSwaggerUIHTML,
	handleExportRequest,
	handleImportRequest,
	renderPreviewHTML,
	type MomentumRequest,
	type UploadRequest,
	type OpenAPIGeneratorOptions,
	sanitizeErrorMessage,
	parseWhereParam,
	validateMimeType,
} from '@momentumcms/server-core';
import type {
	MomentumConfig,
	ResolvedMomentumConfig,
	UserContext,
	UploadedFile,
	DatabaseAdapter,
	EndpointQueryHelper,
	CollectionConfig,
} from '@momentumcms/core';
import { isUploadCollection } from '@momentumcms/core';
import { createLogger } from '@momentumcms/logger';
import { getPluginMiddleware } from './plugin-middleware-registry';

/**
 * Find the email-builder json field in a collection, if any.
 * Returns the field name or undefined.
 */
function getEmailBuilderFieldName(collection: CollectionConfig): string | undefined {
	const field = collection.fields.find(
		(f) => f.type === 'json' && f.admin?.editor === 'email-builder',
	);
	return field?.name;
}

/**
 * Render a full email preview HTML from the doc's email blocks.
 * Returns a complete HTML document (the rendered email) — no field labels or generic wrapper.
 */
async function renderEmailPreviewHTML(
	doc: Record<string, unknown>,
	blocksFieldName: string,
): Promise<string> {
	const { renderEmailFromBlocks } = await import('@momentumcms/email');
	const blocks = doc[blocksFieldName];
	if (!Array.isArray(blocks) || blocks.length === 0) {
		return '<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#666;font-family:sans-serif"><p>No email blocks yet.</p></body></html>';
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- email blocks stored as unknown[]
	return renderEmailFromBlocks({ blocks: blocks as never[] });
}

// sanitizeErrorMessage and parseWhereParam are imported from @momentumcms/server-core

/**
 * Extended Express Request with user context from auth middleware.
 */
interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email?: string;
		role?: string;
		[key: string]: unknown;
	};
}

/**
 * Extracts user context from Express request (set by auth middleware).
 */
function extractUserFromRequest(req: Request): UserContext | undefined {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation
	const authReq = req as AuthenticatedRequest;
	if (authReq.user?.id) {
		return {
			id: authReq.user.id,
			email: authReq.user.email,
			role: authReq.user.role,
		};
	}
	return undefined;
}

/**
 * Creates Express middleware for Momentum CMS API.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { momentumApiMiddleware } from '@momentumcms/server-express';
 * import momentumConfig from './momentum.config';
 *
 * const app = express();
 * app.use('/api', momentumApiMiddleware(momentumConfig));
 * ```
 */
export function momentumApiMiddleware(config: MomentumConfig | ResolvedMomentumConfig): Router {
	const router = Router();
	const handlers = createMomentumHandlers(config);

	// Use Express's built-in JSON body parser
	router.use(jsonParser());

	// Security headers middleware
	router.use((_req: Request, res: Response, next: NextFunction) => {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'SAMEORIGIN');
		res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
		res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
		next();
	});

	// CORS middleware
	router.use((req: Request, res: Response, next: NextFunction) => {
		const corsConfig = config.server?.cors ?? {};
		const origins = Array.isArray(corsConfig.origin)
			? corsConfig.origin
			: corsConfig.origin
				? [corsConfig.origin]
				: [];

		if (origins.length === 0 || origins.includes('*')) {
			if (process.env['NODE_ENV'] === 'production') {
				createLogger('CORS').warn(
					'Origin is set to "*" in production. Configure explicit origins via config.server.cors.origin.',
				);
			}
			res.setHeader('Access-Control-Allow-Origin', '*');
		} else {
			const requestOrigin = req.headers['origin'] ?? '';
			res.setHeader('Vary', 'Origin');
			if (origins.includes(requestOrigin)) {
				res.setHeader('Access-Control-Allow-Origin', requestOrigin);
			}
			// Non-matching origins: omit Access-Control-Allow-Origin entirely (browser will block)
		}
		res.setHeader(
			'Access-Control-Allow-Methods',
			corsConfig.methods?.join(', ') ?? 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
		);
		res.setHeader(
			'Access-Control-Allow-Headers',
			corsConfig.headers?.join(', ') ?? 'Content-Type, Authorization',
		);
		next();
	});

	// Handle preflight requests
	router.options('*', (_req: Request, res: Response) => {
		res.sendStatus(204);
	});

	// Lazy-mount plugin middleware registered during onInit (before-api position).
	// Plugins initialize asynchronously via initializeMomentum(), so middleware descriptors
	// may not be available yet when this router is created. Deferred mounting ensures
	// we read them on the first request (after init completes).
	let beforeApiRouter: Router | null = null;
	router.use((req: Request, res: Response, next: NextFunction) => {
		if (!beforeApiRouter) {
			const pluginMiddleware = getPluginMiddleware();
			const beforeMw = pluginMiddleware.filter(
				(mw) => mw.position !== 'after-api' && mw.position !== 'root',
			);
			if (beforeMw.length > 0) {
				beforeApiRouter = Router();
				for (const mw of beforeMw) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler is Express Router/middleware, cast safe in server-express
					beforeApiRouter.use(mw.path, mw.handler as Router);
				}
			}
		}
		if (beforeApiRouter) {
			beforeApiRouter(req, res, next);
		} else {
			next();
		}
	});

	// Convert Express method to Momentum method type
	function getMethod(method: string): 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' {
		const upperMethod = method.toUpperCase();
		if (
			upperMethod === 'GET' ||
			upperMethod === 'POST' ||
			upperMethod === 'PATCH' ||
			upperMethod === 'PUT' ||
			upperMethod === 'DELETE'
		) {
			return upperMethod;
		}
		return 'GET';
	}

	// Safely extract body from request
	function getBody(req: Request): Record<string, unknown> {
		if (typeof req.body === 'object' && req.body !== null) {
			return req.body;
		}
		return {};
	}

	/**
	 * Check if a collection slug refers to a managed collection.
	 * Managed collections are read-only via the API (owned by a plugin like Better Auth).
	 * GET requests are allowed; write operations (POST/PATCH/PUT/DELETE) return 403.
	 */
	function isManagedCollection(slug: string | undefined): boolean {
		if (!slug) return false;
		const col = config.collections.find((c) => c.slug === slug);
		return col?.managed === true;
	}

	// Route: GET /access - Get collection permissions for current user
	// Must be defined BEFORE /:collection routes to avoid matching "access" as a collection slug
	router.get('/access', async (req: Request, res: Response) => {
		const user = extractUserFromRequest(req);
		const result = await handleAccessRequest({ config, user });
		res.status(result.status).json(result.body);
	});

	// ============================================
	// GraphQL Endpoint
	// ============================================

	const graphqlSchema = buildGraphQLSchema(config.collections);

	// Route: POST /graphql - GraphQL API
	router.post('/graphql', async (req: Request, res: Response) => {
		const result = await handleGraphQLPostRequest(
			graphqlSchema,
			getBody(req),
			extractUserFromRequest(req),
		);
		res.status(result.status).json(result.body);
	});

	// Route: GET /graphql - GraphQL introspection (for tools like GraphiQL)
	router.get('/graphql', async (req: Request, res: Response) => {
		const result = await handleGraphQLGetRequest(
			graphqlSchema,
			req.query['query'],
			extractUserFromRequest(req),
		);
		res.status(result.status).json(result.body);
	});

	// ============================================
	// Globals Routes
	// Must be defined BEFORE generic /:collection routes
	// ============================================

	// Route: GET /globals/:slug - Read a global document
	router.get('/globals/:slug', async (req: Request, res: Response) => {
		const depthParam = req.query['depth'];
		const depth = typeof depthParam === 'string' ? parseInt(depthParam, 10) || 0 : 0;
		const result = await handleGetGlobalRequest({
			slug: req.params['slug'],
			depth,
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: PATCH /globals/:slug - Update a global document
	router.patch('/globals/:slug', async (req: Request, res: Response) => {
		const result = await handleUpdateGlobalRequest({
			slug: req.params['slug'],
			data: getBody(req),
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// ============================================
	// Version Routes
	// Must be defined BEFORE generic /:collection/:id routes
	// ============================================

	// Route: GET /:collection/:id/versions - List versions for a document
	router.get('/:collection/:id/versions', async (req: Request, res: Response) => {
		const result = await handleListVersionsRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
			page: req.query['page'] ? Number(req.query['page']) : undefined,
			includeAutosave: req.query['includeAutosave'] === 'true',
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: GET /:collection/:id/versions/:versionId - Get specific version
	router.get('/:collection/:id/versions/:versionId', async (req: Request, res: Response) => {
		const result = await handleGetVersionRequest({
			collectionSlug: req.params['collection'],
			versionId: req.params['versionId'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/versions/restore - Restore a version
	router.post('/:collection/:id/versions/restore', async (req: Request, res: Response) => {
		const body = getBody(req);
		const result = await handleRestoreVersionRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			versionId: body['versionId'],
			publish: body['publish'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/publish - Publish a document
	router.post('/:collection/:id/publish', async (req: Request, res: Response) => {
		const result = await handlePublishRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/schedule-publish - Schedule for future publishing
	router.post('/:collection/:id/schedule-publish', async (req: Request, res: Response) => {
		const body = getBody(req);
		const result = await handleSchedulePublishRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			publishAt: body['publishAt'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/cancel-scheduled-publish - Cancel scheduled publish
	router.post('/:collection/:id/cancel-scheduled-publish', async (req: Request, res: Response) => {
		const result = await handleCancelScheduledPublishRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/unpublish - Unpublish a document
	router.post('/:collection/:id/unpublish', async (req: Request, res: Response) => {
		const result = await handleUnpublishRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/draft - Save a draft (autosave)
	router.post('/:collection/:id/draft', async (req: Request, res: Response) => {
		const result = await handleSaveDraftRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			data: getBody(req),
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/versions/compare - Compare two versions
	router.post('/:collection/:id/versions/compare', async (req: Request, res: Response) => {
		const body = getBody(req);
		const result = await handleCompareVersionsRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			versionId1: body['versionId1'],
			versionId2: body['versionId2'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// Route: GET /:collection/:id/status - Get document status
	router.get('/:collection/:id/status', async (req: Request, res: Response) => {
		const result = await handleStatusRequest({
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// ============================================
	// Preview Route
	// Returns styled HTML for the live preview iframe
	// Must be defined BEFORE generic /:collection/:id routes
	// ============================================

	/** Shared handler for preview rendering (GET loads from DB, POST uses request body). */
	async function handlePreviewRequest(req: Request, res: Response): Promise<void> {
		try {
			const slug = req.params['collection'];
			const id = req.params['id'];
			const user = extractUserFromRequest(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required to access preview' });
				return;
			}

			const collectionConfig = config.collections.find((c) => c.slug === slug);
			if (!collectionConfig) {
				res.status(404).json({ error: 'Collection not found' });
				return;
			}

			// Enforce collection-level access.read before rendering
			const accessFn = collectionConfig.access?.read;
			if (accessFn) {
				const allowed = await Promise.resolve(accessFn({ req: { user } }));
				if (!allowed) {
					res.status(403).json({ error: 'Access denied' });
					return;
				}
			}

			let doc: Record<string, unknown>;
			if (req.method === 'POST' && req.body?.data) {
				// Live preview: render from form data sent by the client
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- POST body contains form data
				doc = req.body.data as Record<string, unknown>;
			} else {
				// Initial load: render from database
				const api = getMomentumAPI();
				const contextApi = user ? api.setContext({ user }) : api;
				doc = await contextApi.collection(slug).findById(id);
			}

			// For collections with an email-builder field, render the email directly
			const emailField = getEmailBuilderFieldName(collectionConfig);
			const html = emailField
				? await renderEmailPreviewHTML(doc, emailField)
				: renderPreviewHTML({ doc, collection: collectionConfig });
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			res.send(html);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			if (message.includes('Access denied')) {
				res.status(403).json({ error: message });
				return;
			}
			if (message.includes('not found')) {
				res.status(404).json({ error: message });
				return;
			}
			res.status(500).json({ error: 'Preview failed', message });
		}
	}

	router.get('/:collection/:id/preview', handlePreviewRequest);
	router.post('/:collection/:id/preview', handlePreviewRequest);

	// ============================================
	// Media Upload Routes
	// Must be defined BEFORE /:collection routes
	// ============================================

	// Configure multer for memory storage
	const upload = multer({
		storage: multer.memoryStorage(),
		limits: {
			fileSize: config.storage?.maxFileSize ?? 10 * 1024 * 1024, // Default 10MB
		},
	});

	// Build set of upload collection slugs for conditional multer routing
	const uploadCollectionSlugs = new Set(
		config.collections.filter((c) => isUploadCollection(c)).map((c) => c.slug),
	);

	/**
	 * Handle POST for an upload collection: extract file + fields, delegate to handleCollectionUpload.
	 */
	async function handleUploadCollectionPost(req: Request, res: Response): Promise<void> {
		const slug = req.params['collection'];
		const collectionConfig = config.collections.find((c) => c.slug === slug);
		if (!collectionConfig?.upload) {
			res.status(400).json({ error: 'Not an upload collection' });
			return;
		}

		const uploadConfig = getUploadConfig(config);
		if (!uploadConfig) {
			res.status(500).json({ error: 'Storage not configured' });
			return;
		}

		const multerFile = req.file;
		if (!multerFile) {
			res.status(400).json({ error: 'No file provided' });
			return;
		}

		const file: UploadedFile = {
			originalName: multerFile.originalname,
			mimeType: multerFile.mimetype,
			size: multerFile.size,
			buffer: multerFile.buffer,
		};

		// Extract non-file fields from multipart body
		const fields: Record<string, unknown> = {};
		if (typeof req.body === 'object' && req.body !== null) {
			const bodyEntries: Record<string, unknown> = Object(req.body);
			for (const [key, value] of Object.entries(bodyEntries)) {
				if (key !== 'file') {
					fields[key] = value;
				}
			}
		}

		const response = await handleCollectionUpload(uploadConfig, {
			file,
			user: extractUserFromRequest(req),
			fields,
			collectionSlug: slug,
			collectionUpload: collectionConfig.upload,
		});

		res.status(response.status).json(response);
	}

	// Route: POST /media/upload - Upload a file (legacy endpoint)
	// Auth check runs BEFORE multer to reject unauthenticated requests before file processing
	router.post(
		'/media/upload',
		(req: Request, res: Response, next: NextFunction) => {
			const user = extractUserFromRequest(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required to upload files' });
				return;
			}
			next();
		},
		upload.single('file'),
		async (req: Request, res: Response) => {
			const uploadConfig = getUploadConfig(config);
			if (!uploadConfig) {
				res.status(500).json({ error: 'Storage not configured' });
				return;
			}

			const multerFile = req.file;
			if (!multerFile) {
				res.status(400).json({ error: 'No file provided' });
				return;
			}

			// Convert multer file to UploadedFile
			const file: UploadedFile = {
				originalName: multerFile.originalname,
				mimeType: multerFile.mimetype,
				size: multerFile.size,
				buffer: multerFile.buffer,
			};

			// Get alt text from body if provided
			const alt = typeof req.body?.alt === 'string' ? req.body.alt : undefined;

			const uploadRequest: UploadRequest = {
				file,
				user: extractUserFromRequest(req),
				alt,
			};

			const response = await handleUpload(uploadConfig, uploadRequest);
			res.status(response.status).json(response);
		},
	);

	// Route: GET /media/file/:path(*) - Serve uploaded files (public)
	router.get('/media/file/*', async (req: Request, res: Response) => {
		const uploadConfig = getUploadConfig(config);
		if (!uploadConfig) {
			res.status(500).json({ error: 'Storage not configured' });
			return;
		}

		// Extract path from URL (everything after /media/file/)
		const rawPath = req.params[0];
		if (!rawPath) {
			res.status(400).json({ error: 'File path required' });
			return;
		}

		// Sanitize path to prevent directory traversal
		const { normalize, isAbsolute, resolve, sep } = await import('node:path');
		let decodedPath: string;
		try {
			decodedPath = decodeURIComponent(rawPath);
		} catch {
			res.status(400).json({ error: 'Invalid path encoding' });
			return;
		}
		const filePath = normalize(decodedPath);
		if (isAbsolute(filePath) || filePath.includes('..') || filePath.includes(`${sep}..`)) {
			res.status(403).json({ error: 'Invalid file path' });
			return;
		}
		// Double-check: resolve against a fake root and verify we stay inside it
		const fakeRoot = resolve('/safe-root');
		const resolved = resolve(fakeRoot, filePath);
		if (!resolved.startsWith(fakeRoot + sep) && resolved !== fakeRoot) {
			res.status(403).json({ error: 'Invalid file path' });
			return;
		}

		const result = await handleFileGet(uploadConfig.adapter, filePath);
		if (!result) {
			res.status(404).json({ error: 'File not found' });
			return;
		}

		// Set content type if known
		if (result.mimeType) {
			res.setHeader('Content-Type', result.mimeType);
		}

		// Enable caching for static files
		res.setHeader('Cache-Control', 'public, max-age=31536000');

		res.send(result.buffer);
	});

	// ============================================
	// Custom Collection Endpoints
	// ============================================
	// Registered BEFORE generic routes so /:collection/:customPath
	// doesn't get swallowed by /:collection/:id

	/**
	 * Build a query helper backed by a raw DatabaseAdapter (used inside transactions).
	 * Operations go directly through the adapter, bypassing MomentumAPI.
	 */
	function buildTxQueryHelper(txAdapter: DatabaseAdapter): EndpointQueryHelper {
		return {
			find: async (slug, query) => {
				const docs = await txAdapter.find(slug, query ?? {});
				return { docs, totalDocs: docs.length };
			},
			findById: (slug, id) => txAdapter.findById(slug, id),
			count: async (slug, where) => {
				if (txAdapter.count) {
					return txAdapter.count(slug, where ?? {});
				}
				const docs = await txAdapter.find(slug, where ?? {});
				return docs.length;
			},
			create: (slug, data) => txAdapter.create(slug, data),
			update: (slug, id, data) => txAdapter.update(slug, id, data),
			delete: async (slug, id) => {
				const deleted = await txAdapter.delete(slug, id);
				return { id, deleted };
			},
			// Already inside a transaction - nested calls just reuse the same adapter
			transaction: async <T>(callback: (q: EndpointQueryHelper) => Promise<T>): Promise<T> => {
				return callback(buildTxQueryHelper(txAdapter));
			},
		};
	}

	for (const collection of config.collections) {
		// Skip managed collections — they don't have CRUD routes or custom endpoints
		if (collection.managed) continue;
		if (!collection.endpoints || collection.endpoints.length === 0) {
			continue;
		}

		for (const endpoint of collection.endpoints) {
			const routePath = `/${collection.slug}/${endpoint.path.replace(/^\//, '')}`;

			router[endpoint.method](routePath, async (req: Request, res: Response) => {
				try {
					const user = extractUserFromRequest(req);
					const api = getMomentumAPI();
					const contextApi = user ? api.setContext({ user }) : api;

					const buildQueryHelper = (ctxApi: typeof contextApi): EndpointQueryHelper => ({
						find: async (slug, options) => {
							const r = await ctxApi.collection(slug).find(options);
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
							return { docs: r.docs as Record<string, unknown>[], totalDocs: r.totalDocs };
						},
						findById: async (slug, id) => {
							try {
								// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
								return (await ctxApi.collection(slug).findById(id)) as Record<string, unknown>;
							} catch (err) {
								if (err instanceof Error && err.name === 'DocumentNotFoundError') return null;
								throw err;
							}
						},
						count: (slug, where) => ctxApi.collection(slug).count(where),
						create: async (slug, data) => {
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
							return (await ctxApi.collection(slug).create(data)) as Record<string, unknown>;
						},
						update: async (slug, id, data) => {
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
							return (await ctxApi.collection(slug).update(id, data)) as Record<string, unknown>;
						},
						delete: (slug, id) => ctxApi.collection(slug).delete(id),
						transaction: async <T>(
							callback: (q: EndpointQueryHelper) => Promise<T>,
						): Promise<T> => {
							const adapter = config.db.adapter;
							if (adapter.transaction) {
								return adapter.transaction(async (txAdapter) => {
									return callback(buildTxQueryHelper(txAdapter));
								});
							}
							// Fallback: run without transaction
							return callback(buildQueryHelper(ctxApi));
						},
					});

					const result = await endpoint.handler({
						req: { user },
						collection,
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express body is parsed JSON
						body: req.body as Record<string, unknown> | undefined,
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express query params
						params: req.query as Record<string, unknown>,
						query: buildQueryHelper(contextApi),
					});
					res.status(result.status).json(result.body);
				} catch (error) {
					const message = sanitizeErrorMessage(error, 'Custom endpoint error');
					res.status(500).json({ error: message });
				}
			});
		}
	}

	// ============================================
	// Batch Operations Route
	// Must be defined BEFORE generic /:collection routes
	// ============================================

	// Route: POST /:collection/batch - Batch create/update/delete
	router.post('/:collection/batch', async (req: Request, res: Response) => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: req.params['collection'],
			body: getBody(req),
			user: extractUserFromRequest(req),
		});
		res.status(result.status).json(result.body);
	});

	// ============================================
	// Standard Collection Routes
	// ============================================

	// Route: GET /:collection/search - Full-text search
	// Must be defined BEFORE the catch-all /:collection/:id? route
	router.get('/:collection/search', async (req: Request, res: Response) => {
		const fieldsParam = req.query['fields'];
		const request: MomentumRequest = {
			method: 'GET',
			collectionSlug: req.params['collection'],
			query: {
				q: typeof req.query['q'] === 'string' ? req.query['q'] : '',
				fields: typeof fieldsParam === 'string' ? fieldsParam : undefined,
				limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
				page: req.query['page'] ? Number(req.query['page']) : undefined,
			},
			user: extractUserFromRequest(req),
		};

		const response = await handlers.handleSearch(request);
		res.status(response.status ?? 200).json(response);
	});

	// ============================================
	// Import/Export Routes
	// Must be defined BEFORE the catch-all /:collection/:id? route
	// ============================================

	// Route: GET /:collection/export - Export collection documents
	router.get('/:collection/export', async (req: Request, res: Response) => {
		const result = await handleExportRequest({
			collectionSlug: req.params['collection'],
			format: typeof req.query['format'] === 'string' ? req.query['format'] : 'json',
			limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
			user: extractUserFromRequest(req),
			config,
			api: getMomentumAPI(),
		});

		if (result.headers) {
			for (const [key, value] of Object.entries(result.headers)) {
				res.setHeader(key, value);
			}
		}

		if (typeof result.body === 'string') {
			res.status(result.status).send(result.body);
		} else {
			res.status(result.status).json(result.body);
		}
	});

	// Route: POST /:collection/import - Import documents into collection
	router.post('/:collection/import', async (req: Request, res: Response) => {
		const body = getBody(req);
		const collectionSlug = req.params['collection'];
		if (isManagedCollection(collectionSlug)) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const result = await handleImportRequest({
			collectionSlug,
			format: body['format'] === 'csv' ? 'csv' : 'json',
			body,
			dryRun: body['dryRun'] === true,
			user: extractUserFromRequest(req),
			config: { collections: config.collections },
			api: getMomentumAPI(),
		});
		res.status(result.status).json(result.body);
	});

	// Route: POST /:collection/:id/restore - Restore a soft-deleted document
	router.post('/:collection/:id/restore', async (req: Request, res: Response) => {
		if (isManagedCollection(req.params['collection'])) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const request: MomentumRequest = {
			method: 'POST',
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		};

		const response = await handlers.handleRestore(request);
		res.status(response.status ?? 200).json(response);
	});

	// Catch-all: POST /:collection/:id/:unknownAction - 404 for unrecognized actions
	// Must be AFTER all specific action routes (publish, unpublish, draft, restore, etc.)
	router.post('/:collection/:id/:action', (_req: Request, res: Response) => {
		res.status(404).json({
			error: 'Not found',
			message: `Unknown action "${_req.params['action']}"`,
		});
	});

	// Route: GET /:collection - Find all documents
	// Route: GET /:collection/:id - Find document by ID
	router.get('/:collection/:id?', async (req: Request, res: Response) => {
		const sortParam = req.query['sort'];
		const request: MomentumRequest = {
			method: getMethod(req.method),
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			query: {
				limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
				page: req.query['page'] ? Number(req.query['page']) : undefined,
				sort: typeof sortParam === 'string' ? sortParam : undefined,
				depth: req.query['depth'] ? Number(req.query['depth']) : undefined,
				where: parseWhereParam(req.query['where']),
				withDeleted: req.query['withDeleted'] === 'true',
				onlyDeleted: req.query['onlyDeleted'] === 'true',
			},
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: POST /:collection - Create document (with upload support for upload collections)
	router.post('/:collection', (req: Request, res: Response, next: NextFunction) => {
		const slug = req.params['collection'];

		if (uploadCollectionSlugs.has(slug)) {
			// Upload collection: auth check before multer to reject early
			const user = extractUserFromRequest(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required to upload files' });
				return;
			}
			// Use multer for multipart/form-data
			upload.single('file')(req, res, (err) => {
				if (err) {
					res.status(400).json({ error: err.message });
					return;
				}
				handleUploadCollectionPost(req, res).catch((e) => {
					const message = sanitizeErrorMessage(e, 'Upload failed');
					res.status(500).json({ error: message });
				});
			});
		} else {
			// Non-upload collection: standard JSON create
			next();
		}
	});

	// Fallback POST /:collection for non-upload collections (standard JSON)
	router.post('/:collection', async (req: Request, res: Response) => {
		if (isManagedCollection(req.params['collection'])) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const request: MomentumRequest = {
			method: 'POST',
			collectionSlug: req.params['collection'],
			body: getBody(req),
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: PATCH /:collection/:id - Update document (with optional file replacement for upload collections)
	router.patch('/:collection/:id', (req: Request, res: Response, next: NextFunction) => {
		const slug = req.params['collection'];

		if (uploadCollectionSlugs.has(slug)) {
			// Upload collection: auth check before multer to reject early
			const user = extractUserFromRequest(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required to upload files' });
				return;
			}

			// JSON PATCH requests should bypass multer entirely. The router-level JSON parser
			// has already consumed the body stream, so re-running multipart parsing here
			// crashes with a disturbed/locked body error before the update handler runs.
			if (!req.is('multipart/form-data')) {
				const request: MomentumRequest = {
					method: 'PATCH',
					collectionSlug: slug,
					id: req.params['id'],
					body: getBody(req),
					user,
				};
				handlers
					.routeRequest(request)
					.then((response) => {
						res.status(response.status ?? 200).json(response);
					})
					.catch((error: unknown) => {
						const message = sanitizeErrorMessage(error, 'Upload update failed');
						res.status(500).json({ error: message });
					});
				return;
			}

			// Try multer to parse optional file from multipart
			upload.single('file')(req, res, async (err) => {
				if (err) {
					res.status(400).json({ error: err.message });
					return;
				}

				if (req.file) {
					// File replacement: store new file, merge metadata, update doc
					const collectionConfig = config.collections.find((c) => c.slug === slug);
					if (!collectionConfig?.upload) {
						res.status(400).json({ error: 'Not an upload collection' });
						return;
					}

					const uploadConfig = getUploadConfig(config);
					if (!uploadConfig) {
						res.status(500).json({ error: 'Storage not configured' });
						return;
					}

					const file: UploadedFile = {
						originalName: req.file.originalname,
						mimeType: req.file.mimetype,
						size: req.file.size,
						buffer: req.file.buffer,
					};

					// Extract non-file fields from multipart body
					const fields: Record<string, unknown> = {};
					if (typeof req.body === 'object' && req.body !== null) {
						const bodyEntries: Record<string, unknown> = Object(req.body);
						for (const [key, value] of Object.entries(bodyEntries)) {
							if (key !== 'file') {
								fields[key] = value;
							}
						}
					}

					// Store new file
					try {
						const { validateMimeType: validateMimeByMagicBytes } = await import(
							'@momentumcms/storage'
						);
						const maxFileSize =
							collectionConfig.upload.maxFileSize ?? uploadConfig.maxFileSize ?? 10 * 1024 * 1024;
						const allowedMimeTypes =
							collectionConfig.upload.mimeTypes ?? uploadConfig.allowedMimeTypes ?? [];

						// Validate size
						if (file.size > maxFileSize) {
							const maxMB = (maxFileSize / (1024 * 1024)).toFixed(1);
							const fileMB = (file.size / (1024 * 1024)).toFixed(1);
							res.status(400).json({
								error: `File size ${fileMB}MB exceeds maximum allowed size of ${maxMB}MB`,
							});
							return;
						}

						// Validate claimed MIME type against allowed list
						const mimeError = validateMimeType(file.mimeType, allowedMimeTypes);
						if (mimeError) {
							res.status(400).json({ error: mimeError });
							return;
						}

						// Validate magic bytes
						if (file.buffer && file.buffer.length > 0) {
							const magicByteResult = validateMimeByMagicBytes(
								file.buffer,
								file.mimeType,
								allowedMimeTypes,
							);
							if (!magicByteResult.valid) {
								res.status(400).json({
									error: magicByteResult.error ?? 'File content does not match claimed type',
								});
								return;
							}
						}

						// Store file
						const storedFile = await uploadConfig.adapter.upload(file);

						// Merge metadata with user fields
						const updateData: Record<string, unknown> = {
							...fields,
							filename: file.originalName,
							mimeType: file.mimeType,
							filesize: file.size,
							path: storedFile.path,
							url: storedFile.url,
						};

						// user already extracted and validated before multer
						const api = getMomentumAPI();
						const contextApi = api.setContext({ user });
						const doc = await contextApi.collection(slug).update(req.params['id'], updateData);
						res.json({ doc });
					} catch (error) {
						const message = sanitizeErrorMessage(error, 'Upload update failed');
						res.status(500).json({ error: message });
					}
				} else {
					// No file: standard JSON update with multipart fields
					const body: Record<string, unknown> =
						typeof req.body === 'object' && req.body !== null ? Object(req.body) : {};
					const request: MomentumRequest = {
						method: 'PATCH',
						collectionSlug: slug,
						id: req.params['id'],
						body,
						user, // already extracted and validated before multer
					};
					const response = await handlers.routeRequest(request);
					res.status(response.status ?? 200).json(response);
				}
			});
		} else {
			next();
		}
	});

	// Fallback PATCH for non-upload collections (standard JSON)
	router.patch('/:collection/:id', async (req: Request, res: Response) => {
		if (isManagedCollection(req.params['collection'])) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const request: MomentumRequest = {
			method: 'PATCH',
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			body: getBody(req),
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: PUT /:collection/:id - Replace document
	router.put('/:collection/:id', async (req: Request, res: Response) => {
		if (isManagedCollection(req.params['collection'])) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const request: MomentumRequest = {
			method: 'PUT',
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			body: getBody(req),
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: DELETE /:collection/:id - Delete document
	router.delete('/:collection/:id', async (req: Request, res: Response) => {
		if (isManagedCollection(req.params['collection'])) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const force = req.query['force'] === 'true';
		const request: MomentumRequest = {
			method: 'DELETE',
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		};

		const response = force
			? await handlers.handleForceDelete(request)
			: await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Lazy-mount plugin middleware registered during onInit (after-api position)
	let afterApiRouter: Router | null = null;
	router.use((req: Request, res: Response, next: NextFunction) => {
		if (!afterApiRouter) {
			const pluginMiddleware = getPluginMiddleware();
			const afterMw = pluginMiddleware.filter((mw) => mw.position === 'after-api');
			if (afterMw.length > 0) {
				afterApiRouter = Router();
				for (const mw of afterMw) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler is Express Router/middleware, cast safe in server-express
					afterApiRouter.use(mw.path, mw.handler as Router);
				}
			}
		}
		if (afterApiRouter) {
			afterApiRouter(req, res, next);
		} else {
			next();
		}
	});

	return router;
}

/**
 * OpenAPI docs middleware configuration.
 */
export interface OpenAPIDocsConfig {
	/** Momentum config (used to generate the spec from collections) */
	config: MomentumConfig | ResolvedMomentumConfig;
	/** OpenAPI generator options (title, version, description, servers) */
	openapi?: OpenAPIGeneratorOptions;
}

/**
 * Creates Express middleware that serves OpenAPI docs.
 *
 * Provides two endpoints:
 * - GET /openapi.json - the generated OpenAPI 3.0 spec
 * - GET / - Swagger UI HTML page
 *
 * Mount this BEFORE the momentum API middleware to avoid route conflicts.
 *
 * @example
 * ```typescript
 * app.use('/api/docs', createOpenAPIMiddleware({
 *   config: momentumConfig,
 *   openapi: { title: 'My API', version: '2.0.0' },
 * }));
 * app.use('/api', momentumApiMiddleware(momentumConfig));
 * ```
 */
export function createOpenAPIMiddleware(docsConfig: OpenAPIDocsConfig): Router {
	const docsRouter = Router();
	let cachedSpec: ReturnType<typeof generateOpenAPISpec> | null = null;

	docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
		if (!cachedSpec) {
			cachedSpec = generateOpenAPISpec(docsConfig.config, docsConfig.openapi);
		}
		res.setHeader('Cache-Control', 'public, max-age=3600');
		res.json(cachedSpec);
	});

	docsRouter.get('/', (_req: Request, res: Response) => {
		res.setHeader('Content-Type', 'text/html');
		res.send(getSwaggerUIHTML());
	});

	return docsRouter;
}

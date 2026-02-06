import { Router, json as jsonParser } from 'express';
import type { Request, Response, NextFunction } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- multer requires CommonJS import
const multer = require('multer') as typeof import('multer');
import {
	createMomentumHandlers,
	getCollectionPermissions,
	getMomentumAPI,
	handleUpload,
	handleFileGet,
	getUploadConfig,
	buildGraphQLSchema,
	executeGraphQL,
	generateOpenAPISpec,
	exportToJson,
	exportToCsv,
	parseJsonImport,
	parseCsvImport,
	renderPreviewHTML,
	type MomentumRequest,
	type UploadRequest,
	type GraphQLRequestBody,
	type OpenAPIGeneratorOptions,
	type ExportFormat,
	type ImportResult,
} from '@momentum-cms/server-core';
import type {
	MomentumConfig,
	ResolvedMomentumConfig,
	UserContext,
	UploadedFile,
	DatabaseAdapter,
	EndpointQueryHelper,
} from '@momentum-cms/core';

/**
 * Sanitize error messages to prevent leaking internal details (SQL, file paths, etc.).
 */
function sanitizeErrorMessage(error: unknown, fallback: string): string {
	if (!(error instanceof Error)) return fallback;
	const msg = error.message;
	// Strip messages that look like they contain SQL, file paths, or stack traces
	if (/SELECT |INSERT |UPDATE |DELETE |FROM |WHERE /i.test(msg)) return fallback;
	if (/\/[a-z_-]+\/[a-z_-]+\//i.test(msg) && msg.includes('/')) return fallback;
	if (msg.includes('at ') && msg.includes('.js:')) return fallback;
	return msg;
}

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
 * import { momentumApiMiddleware } from '@momentum-cms/server-express';
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

	// CORS middleware
	router.use((_req: Request, res: Response, next: NextFunction) => {
		const corsConfig = config.server?.cors ?? {};
		const origin = Array.isArray(corsConfig.origin) ? corsConfig.origin[0] : corsConfig.origin;
		const allowOrigin = origin ?? '*';
		if (allowOrigin === '*' && process.env['NODE_ENV'] === 'production') {
			console.warn(
				'[Momentum] CORS origin is set to "*" in production. Configure explicit origins via config.server.cors.origin.',
			);
		}
		res.setHeader('Access-Control-Allow-Origin', allowOrigin);
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

	// Route: GET /access - Get collection permissions for current user
	// Must be defined BEFORE /:collection routes to avoid matching "access" as a collection slug
	router.get('/access', async (req: Request, res: Response) => {
		const user = extractUserFromRequest(req);
		const permissions = await getCollectionPermissions(config, user);
		res.json({ collections: permissions });
	});

	// ============================================
	// GraphQL Endpoint
	// ============================================

	const graphqlSchema = buildGraphQLSchema(config.collections);

	// Route: POST /graphql - GraphQL API
	router.post('/graphql', async (req: Request, res: Response) => {
		const user = extractUserFromRequest(req);

		const rawBody = getBody(req);
		const body: GraphQLRequestBody = {
			query: typeof rawBody['query'] === 'string' ? rawBody['query'] : '',
			variables:
				typeof rawBody['variables'] === 'object' && rawBody['variables'] !== null
					? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
						(rawBody['variables'] as Record<string, unknown>)
					: undefined,
			operationName:
				typeof rawBody['operationName'] === 'string' ? rawBody['operationName'] : undefined,
		};

		const result = await executeGraphQL(graphqlSchema, body, {
			user,
		});

		res.status(result.status).json(result.body);
	});

	// Route: GET /graphql - GraphQL introspection (for tools like GraphiQL)
	router.get('/graphql', async (req: Request, res: Response) => {
		const user = extractUserFromRequest(req);
		const queryParam = req.query['query'];
		if (typeof queryParam !== 'string') {
			res.status(400).json({ errors: [{ message: 'Query parameter required' }] });
			return;
		}

		const result = await executeGraphQL(graphqlSchema, { query: queryParam }, { user });

		res.status(result.status).json(result.body);
	});

	// ============================================
	// Version Routes
	// Must be defined BEFORE generic /:collection/:id routes
	// ============================================

	// Route: GET /:collection/:id/versions - List versions for a document
	router.get('/:collection/:id/versions', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const result = await versionOps.findVersions(req.params['id'], {
				limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
				page: req.query['page'] ? Number(req.query['page']) : undefined,
				includeAutosave: req.query['includeAutosave'] === 'true',
			});

			res.json(result);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to fetch versions', message });
		}
	});

	// Route: GET /:collection/:id/versions/:versionId - Get specific version
	router.get('/:collection/:id/versions/:versionId', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const version = await versionOps.findVersionById(req.params['versionId']);

			if (!version) {
				res.status(404).json({
					error: 'Version not found',
					message: `Version "${req.params['versionId']}" not found`,
				});
				return;
			}

			res.json(version);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to fetch version', message });
		}
	});

	// Route: POST /:collection/:id/versions/restore - Restore a version
	router.post('/:collection/:id/versions/restore', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const body = getBody(req);
			const versionId = body['versionId'];

			if (typeof versionId !== 'string') {
				res.status(400).json({
					error: 'Invalid request',
					message: 'versionId is required in request body',
				});
				return;
			}

			const restored = await versionOps.restore({
				versionId,
				publish: body['publish'] === true,
			});

			res.json({ doc: restored, message: 'Version restored successfully' });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to restore version', message });
		}
	});

	// Route: POST /:collection/:id/publish - Publish a document
	router.post('/:collection/:id/publish', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const published = await versionOps.publish(req.params['id']);

			res.json({ doc: published, message: 'Document published successfully' });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to publish document', message });
		}
	});

	// Route: POST /:collection/:id/schedule-publish - Schedule a document for future publishing
	router.post('/:collection/:id/schedule-publish', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- req.body type unknown
			const { publishAt } = req.body as { publishAt?: string };
			if (!publishAt) {
				res.status(400).json({
					error: 'Missing publishAt',
					message: 'A publishAt ISO date string is required',
				});
				return;
			}

			const result = await versionOps.schedulePublish(req.params['id'], publishAt);
			res.json(result);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to schedule publish', message });
		}
	});

	// Route: POST /:collection/:id/cancel-scheduled-publish - Cancel scheduled publish
	router.post('/:collection/:id/cancel-scheduled-publish', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			await versionOps.cancelScheduledPublish(req.params['id']);
			res.json({ message: 'Scheduled publish cancelled' });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to cancel scheduled publish', message });
		}
	});

	// Route: POST /:collection/:id/unpublish - Unpublish a document
	router.post('/:collection/:id/unpublish', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const unpublished = await versionOps.unpublish(req.params['id']);

			res.json({ doc: unpublished, message: 'Document unpublished successfully' });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to unpublish document', message });
		}
	});

	// Route: POST /:collection/:id/draft - Save a draft (autosave)
	router.post('/:collection/:id/draft', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const body = getBody(req);
			const draft = await versionOps.saveDraft(req.params['id'], body);

			res.json({ version: draft, message: 'Draft saved successfully' });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to save draft', message });
		}
	});

	// Route: POST /:collection/:id/versions/compare - Compare two versions
	router.post('/:collection/:id/versions/compare', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Request body typing
			const { versionId1, versionId2 } = req.body as {
				versionId1: string;
				versionId2: string;
			};

			if (!versionId1 || !versionId2) {
				res.status(400).json({
					error: 'Missing version IDs',
					message: 'Both versionId1 and versionId2 are required',
				});
				return;
			}

			const differences = await versionOps.compare(versionId1, versionId2);

			res.json({ differences });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to compare versions', message });
		}
	});

	// Route: GET /:collection/:id/status - Get document status
	router.get('/:collection/:id/status', async (req: Request, res: Response) => {
		try {
			const api = getMomentumAPI();
			const user = extractUserFromRequest(req);
			const contextApi = user ? api.setContext({ user }) : api;

			const collectionOps = contextApi.collection(req.params['collection']);
			const versionOps = collectionOps.versions();

			if (!versionOps) {
				res.status(400).json({
					error: 'Versioning not enabled',
					message: `Collection "${req.params['collection']}" does not have versioning enabled`,
				});
				return;
			}

			const status = await versionOps.getStatus(req.params['id']);

			res.json({ status });
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Unknown error');
			res.status(500).json({ error: 'Failed to get status', message });
		}
	});

	// ============================================
	// Preview Route
	// Returns styled HTML for the live preview iframe
	// Must be defined BEFORE generic /:collection/:id routes
	// ============================================

	router.get('/:collection/:id/preview', async (req: Request, res: Response) => {
		try {
			const slug = req.params['collection'];
			const id = req.params['id'];
			const user = extractUserFromRequest(req);

			const api = getMomentumAPI();
			const contextApi = user ? api.setContext({ user }) : api;

			const doc = await contextApi.collection(slug).findById(id);
			if (!doc) {
				res.status(404).json({ error: 'Document not found' });
				return;
			}

			// Find collection config
			const collectionConfig = config.collections.find((c) => c.slug === slug);
			if (!collectionConfig) {
				res.status(404).json({ error: 'Collection not found' });
				return;
			}

			const html = renderPreviewHTML({ doc, collection: collectionConfig });
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
	});

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

	// Route: POST /media/upload - Upload a file
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

	// Route: GET /media/file/:path(*) - Serve uploaded files
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
		const filePath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
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
			count: async (slug) => {
				const docs = await txAdapter.find(slug, {});
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
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
							return (await ctxApi.collection(slug).findById(id)) as Record<string, unknown> | null;
						},
						count: (slug) => ctxApi.collection(slug).count(),
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
	const MAX_BATCH_SIZE = 100;
	router.post('/:collection/batch', async (req: Request, res: Response) => {
		try {
			const user = extractUserFromRequest(req);
			const api = getMomentumAPI();
			const contextApi = user ? api.setContext({ user }) : api;
			const body = getBody(req);
			const operation = body['operation'];
			const collectionSlug = req.params['collection'];

			if (operation === 'create') {
				const items = body['items'];
				if (!Array.isArray(items)) {
					res.status(400).json({ error: 'items must be an array' });
					return;
				}
				if (items.length > MAX_BATCH_SIZE) {
					res.status(400).json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items` });
					return;
				}
				const docs = await contextApi.collection(collectionSlug).batchCreate(items);
				res.status(201).json({ docs, message: `${docs.length} documents created` });
			} else if (operation === 'update') {
				const items = body['items'];
				if (!Array.isArray(items)) {
					res.status(400).json({ error: 'items must be an array' });
					return;
				}
				if (items.length > MAX_BATCH_SIZE) {
					res.status(400).json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items` });
					return;
				}
				const docs = await contextApi.collection(collectionSlug).batchUpdate(items);
				res.json({ docs, message: `${docs.length} documents updated` });
			} else if (operation === 'delete') {
				const ids = body['ids'];
				if (!Array.isArray(ids)) {
					res.status(400).json({ error: 'ids must be an array' });
					return;
				}
				if (ids.length > MAX_BATCH_SIZE) {
					res.status(400).json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items` });
					return;
				}
				const results = await contextApi.collection(collectionSlug).batchDelete(ids);
				res.json({ results, message: `${results.length} documents deleted` });
			} else {
				res.status(400).json({
					error: 'Invalid operation',
					message: 'operation must be "create", "update", or "delete"',
				});
			}
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Batch operation failed');
			const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
			res.status(status).json({ error: message });
		}
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
		try {
			const user = extractUserFromRequest(req);
			const api = getMomentumAPI();
			const contextApi = user ? api.setContext({ user }) : api;
			const collectionSlug = req.params['collection'];

			const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
			if (!collectionConfig) {
				res.status(404).json({ error: `Collection "${collectionSlug}" not found` });
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Validated below
			const format = (
				typeof req.query['format'] === 'string' ? req.query['format'] : 'json'
			) as ExportFormat;
			if (format !== 'json' && format !== 'csv') {
				res.status(400).json({ error: 'Invalid format. Use "json" or "csv"' });
				return;
			}

			const limit = req.query['limit'] ? Number(req.query['limit']) : 10000;

			// Fetch all documents (paginated to limit)
			const result = await contextApi.collection(collectionSlug).find({
				limit,
			});

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			const docs = result.docs as Record<string, unknown>[];

			if (format === 'csv') {
				const exportResult = exportToCsv(docs, collectionConfig);
				res.setHeader('Content-Type', 'text/csv');
				res.setHeader('Content-Disposition', `attachment; filename="${collectionSlug}-export.csv"`);
				res.send(exportResult.data);
			} else {
				const exportResult = exportToJson(docs, collectionConfig);
				res.setHeader(
					'Content-Disposition',
					`attachment; filename="${collectionSlug}-export.json"`,
				);
				res.json({
					collection: collectionSlug,
					format: 'json',
					totalDocs: exportResult.totalDocs,
					docs: exportResult.docs,
				});
			}
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Export failed');
			res.status(500).json({ error: message });
		}
	});

	// Route: POST /:collection/import - Import documents into collection
	router.post('/:collection/import', async (req: Request, res: Response) => {
		try {
			const user = extractUserFromRequest(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required to import data' });
				return;
			}

			const api = getMomentumAPI();
			const contextApi = api.setContext({ user });
			const collectionSlug = req.params['collection'];

			const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
			if (!collectionConfig) {
				res.status(404).json({ error: `Collection "${collectionSlug}" not found` });
				return;
			}

			const body = getBody(req);
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Validated below
			const format = (typeof body['format'] === 'string' ? body['format'] : 'json') as ExportFormat;

			let docsToImport: Record<string, unknown>[];
			let parseError: string | undefined;

			if (format === 'csv') {
				const csvData = body['data'];
				if (typeof csvData !== 'string') {
					res.status(400).json({ error: 'CSV import requires "data" field with CSV string' });
					return;
				}
				const parsed = parseCsvImport(csvData, collectionConfig);
				docsToImport = parsed.docs;
				parseError = parsed.error;
			} else {
				const parsed = parseJsonImport(body['docs'] ?? body['data'] ?? body);
				docsToImport = parsed.docs;
				parseError = parsed.error;
			}

			if (parseError) {
				res.status(400).json({ error: parseError });
				return;
			}

			if (docsToImport.length === 0) {
				res.status(400).json({ error: 'No documents to import' });
				return;
			}

			// Import each document, collecting errors
			const result: ImportResult = {
				imported: 0,
				total: docsToImport.length,
				errors: [],
				docs: [],
			};

			for (let i = 0; i < docsToImport.length; i++) {
				try {
					const doc = await contextApi.collection(collectionSlug).create(docsToImport[i]);
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result.docs.push(doc as Record<string, unknown>);
					result.imported++;
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : 'Unknown error';
					result.errors.push({
						index: i,
						message: errMsg,
						data: docsToImport[i],
					});
				}
			}

			const status = result.imported > 0 ? 200 : 400;
			res.status(status).json(result);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Import failed');
			res.status(500).json({ error: message });
		}
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
			},
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: POST /:collection - Create document
	router.post('/:collection', async (req: Request, res: Response) => {
		const request: MomentumRequest = {
			method: 'POST',
			collectionSlug: req.params['collection'],
			body: getBody(req),
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
	});

	// Route: PATCH /:collection/:id - Update document
	router.patch('/:collection/:id', async (req: Request, res: Response) => {
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
		const request: MomentumRequest = {
			method: 'DELETE',
			collectionSlug: req.params['collection'],
			id: req.params['id'],
			user: extractUserFromRequest(req),
		};

		const response = await handlers.routeRequest(request);
		res.status(response.status ?? 200).json(response);
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

/**
 * Returns a minimal Swagger UI HTML page that loads the OpenAPI spec
 * from the adjacent openapi.json endpoint via CDN-hosted Swagger UI.
 */
function getSwaggerUIHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Momentum CMS - API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>html{box-sizing:border-box;overflow-y:scroll}*,*:before,*:after{box-sizing:inherit}body{margin:0;background:#fafafa}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: './openapi.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: 'BaseLayout',
  deepLinking: true,
  defaultModelsExpandDepth: 1,
});
</script>
</body>
</html>`;
}

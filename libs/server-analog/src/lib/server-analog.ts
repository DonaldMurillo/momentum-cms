import {
	createMomentumHandlers,
	getMomentumAPI,
	getCollectionPermissions,
	GlobalNotFoundError,
	buildGraphQLSchema,
	executeGraphQL,
	handleUpload,
	handleFileGet,
	getUploadConfig,
	exportToJson,
	exportToCsv,
	parseJsonImport,
	parseCsvImport,
	renderPreviewHTML,
	type MomentumRequest,
	type MomentumResponse,
	type GraphQLRequestBody,
	type ExportFormat,
	type ImportResult,
	type UploadRequest,
} from '@momentum-cms/server-core';
import type {
	MomentumConfig,
	ResolvedMomentumConfig,
	UserContext,
	UploadedFile,
	EndpointQueryHelper,
	DatabaseAdapter,
} from '@momentum-cms/core';

// ============================================
// H3 Type Definitions
// ============================================

/**
 * H3 Event interface (simplified for type compatibility).
 */
export interface H3Event {
	method: string;
	path: string;
	context: {
		params?: Record<string, string>;
	};
	node?: {
		req: {
			url?: string;
		};
	};
}

/**
 * Type for readBody function from h3.
 */
export type ReadBodyFn = (event: H3Event) => Promise<Record<string, unknown>>;

/**
 * Type for getQuery function from h3.
 */
export type GetQueryFn = (event: H3Event) => Record<string, string | string[]>;

/**
 * Type for getRouterParams function from h3.
 */
export type GetRouterParamsFn = (event: H3Event) => Record<string, string>;

/**
 * Type for setResponseHeader function from h3.
 */
export type SetResponseHeaderFn = (event: H3Event, key: string, value: string) => void;

/**
 * Type for readMultipartFormData function from h3.
 */
export type ReadMultipartFormDataFn = (event: H3Event) => Promise<
	| Array<{
			name?: string;
			filename?: string;
			type?: string;
			data: Buffer;
	  }>
	| undefined
>;

/**
 * Type for send function from h3.
 */
export type SendFn = (event: H3Event, data: Buffer | string, type?: string) => unknown;

/**
 * Extended h3 utilities for comprehensive API handling.
 */
export interface MomentumH3Utils {
	// Method syntax is intentional — bivariant checking allows h3's real H3Event
	// to be compatible with our simplified H3Event without a direct h3 dependency.
	readBody(event: H3Event): Promise<Record<string, unknown>>;
	getQuery(event: H3Event): Record<string, string | string[]>;
	getRouterParams(event: H3Event): Record<string, string>;
	setResponseStatus(event: H3Event, status: number): void;
	setResponseHeader(event: H3Event, key: string, value: string): void;
	readMultipartFormData(event: H3Event): Promise<
		| Array<{
				name?: string;
				filename?: string;
				type?: string;
				data: Buffer;
		  }>
		| undefined
	>;
	send(event: H3Event, data: Buffer | string, type?: string): unknown;
}

// ============================================
// Shared Helpers
// ============================================

/**
 * Parses the `where` query parameter.
 * Handles both JSON string format (?where={"slug":{"equals":"home"}})
 * and pre-parsed object format from h3/qs.
 */
function parseWhereParam(raw: unknown): Record<string, unknown> | undefined {
	if (typeof raw === 'string') {
		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	}
	if (typeof raw === 'object' && raw !== null) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- qs parsed object
		return raw as Record<string, unknown>;
	}
	return undefined;
}

/**
 * Sanitize error messages to prevent leaking internal details (SQL, file paths, etc.).
 */
function sanitizeErrorMessage(error: unknown, fallback: string): string {
	if (!(error instanceof Error)) return fallback;
	const msg = error.message;
	if (/SELECT |INSERT |UPDATE |DELETE |FROM |WHERE /i.test(msg)) return fallback;
	if (/\/[a-z_-]+\/[a-z_-]+\//i.test(msg) && msg.includes('/')) return fallback;
	if (msg.includes('at ') && msg.includes('.js:')) return fallback;
	return msg;
}

/**
 * Convert string method to MomentumRequest method type.
 */
function toMomentumMethod(m: string): MomentumRequest['method'] {
	if (m === 'GET' || m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') {
		return m;
	}
	return 'GET';
}

// ============================================
// Legacy Handlers (kept for backward compat)
// ============================================

/**
 * Creates an h3 event handler for Momentum CMS API.
 *
 * Usage in Analog.js:
 * ```typescript
 * // src/server/routes/api/[...momentum].ts
 * import { defineEventHandler, readBody, getQuery, getRouterParams } from 'h3';
 * import { createMomentumHandler } from '@momentum-cms/server-analog';
 * import momentumConfig from '../../../momentum.config';
 *
 * const handler = createMomentumHandler(momentumConfig);
 *
 * export default defineEventHandler(async (event) => {
 *   return handler(event, { readBody, getQuery, getRouterParams });
 * });
 * ```
 */
export function createMomentumHandler(config: MomentumConfig | ResolvedMomentumConfig): (
	event: H3Event,
	utils: {
		readBody: ReadBodyFn;
		getQuery: GetQueryFn;
		getRouterParams: GetRouterParamsFn;
	},
) => Promise<{
	status: number;
	body: MomentumResponse;
}> {
	const handlers = createMomentumHandlers(config);

	return async (event, utils) => {
		const { readBody, getQuery, getRouterParams } = utils;
		const method = event.method.toUpperCase();

		// Parse route: /api/posts or /api/posts/123
		const params = getRouterParams(event);
		const pathSegments = (params['momentum'] ?? '').split('/').filter(Boolean);
		const collectionSlug = pathSegments[0] ?? '';
		const id = pathSegments[1];

		// Parse query params
		const queryParams = getQuery(event);
		const sortParam = queryParams['sort'];
		const query = {
			limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
			page: queryParams['page'] ? Number(queryParams['page']) : undefined,
			sort: typeof sortParam === 'string' ? sortParam : undefined,
			depth: queryParams['depth'] ? Number(queryParams['depth']) : undefined,
			where: parseWhereParam(queryParams['where']),
			withDeleted: queryParams['withDeleted'] === 'true',
			onlyDeleted: queryParams['onlyDeleted'] === 'true',
		};

		// Parse body for POST/PATCH/PUT
		let body: Record<string, unknown> = {};
		if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
			try {
				body = await readBody(event);
			} catch {
				body = {};
			}
		}

		// Create Momentum request
		const request: MomentumRequest = {
			method: toMomentumMethod(method),
			collectionSlug,
			id,
			body,
			query,
		};

		// Route the request
		const response = await handlers.routeRequest(request);

		return {
			status: response.status ?? 200,
			body: response,
		};
	};
}

/**
 * Simplified handler that returns the response directly (for use with defineEventHandler).
 * This version handles method extraction and body parsing internally.
 */
export function createSimpleMomentumHandler(config: MomentumConfig | ResolvedMomentumConfig): (
	event: H3Event,
	utils: {
		readBody: ReadBodyFn;
		getQuery: GetQueryFn;
		getRouterParams: GetRouterParamsFn;
		setResponseStatus: (event: H3Event, status: number) => void;
	},
) => Promise<MomentumResponse> {
	const baseHandler = createMomentumHandler(config);

	return async (event, utils) => {
		const { setResponseStatus, ...rest } = utils;
		const result = await baseHandler(event, rest);
		setResponseStatus(event, result.status);
		return result.body;
	};
}

// ============================================
// Comprehensive Handler
// ============================================

const MAX_BATCH_SIZE = 100;

/**
 * Creates a comprehensive h3 event handler that mirrors all Express API routes.
 * Handles: access control, GraphQL, globals, versioning, publishing, media,
 * batch operations, search, import/export, custom endpoints, preview, and CRUD.
 *
 * Usage in Analog.js:
 * ```typescript
 * import { defineEventHandler, readBody, getQuery, getRouterParams,
 *   setResponseStatus, setResponseHeader, readMultipartFormData, send, getHeaders } from 'h3';
 * import { createComprehensiveMomentumHandler } from '@momentum-cms/server-analog';
 *
 * const handler = createComprehensiveMomentumHandler(momentumConfig);
 *
 * export default defineEventHandler(async (event) => {
 *   const user = await resolveSession(event);
 *   return handler(event, { readBody, getQuery, ... }, { user });
 * });
 * ```
 */
export function createComprehensiveMomentumHandler(
	config: MomentumConfig | ResolvedMomentumConfig,
): (event: H3Event, utils: MomentumH3Utils, context?: { user?: UserContext }) => Promise<unknown> {
	const handlers = createMomentumHandlers(config);
	const graphqlSchema = buildGraphQLSchema(config.collections);

	// Build a map of custom endpoints for fast lookup
	const customEndpointMap = new Map<
		string,
		{
			method: string;

			endpoint: NonNullable<(typeof config.collections)[number]['endpoints']>[number];
			collection: (typeof config.collections)[number];
		}
	>();
	for (const collection of config.collections) {
		if (collection.managed || !collection.endpoints) continue;
		for (const endpoint of collection.endpoints) {
			const key = `${endpoint.method.toUpperCase()}:${collection.slug}/${endpoint.path.replace(/^\//, '')}`;
			customEndpointMap.set(key, { method: endpoint.method, endpoint, collection });
		}
	}

	/**
	 * Check if a collection slug refers to a managed (read-only) collection.
	 */
	function isManagedCollection(slug: string | undefined): boolean {
		if (!slug) return false;
		const col = config.collections.find((c) => c.slug === slug);
		return col?.managed === true;
	}

	/**
	 * Get API instance with user context applied.
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	function getContextualAPI(user?: UserContext) {
		const api = getMomentumAPI();
		return user ? api.setContext({ user }) : api;
	}

	/**
	 * Build a query helper for custom endpoints (same pattern as Express).
	 */

	function buildQueryHelper(contextApi: ReturnType<typeof getContextualAPI>): EndpointQueryHelper {
		return {
			find: async (slug, options) => {
				const r = await contextApi.collection(slug).find(options);
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return { docs: r.docs as Record<string, unknown>[], totalDocs: r.totalDocs };
			},
			findById: async (slug, id) => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return (await contextApi.collection(slug).findById(id)) as Record<string, unknown> | null;
			},
			count: (slug) => contextApi.collection(slug).count(),
			create: async (slug, data) => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return (await contextApi.collection(slug).create(data)) as Record<string, unknown>;
			},
			update: async (slug, id, data) => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return (await contextApi.collection(slug).update(id, data)) as Record<string, unknown>;
			},
			delete: (slug, id) => contextApi.collection(slug).delete(id),
			transaction: async <T>(callback: (q: EndpointQueryHelper) => Promise<T>): Promise<T> => {
				const adapter = config.db.adapter;
				if (adapter.transaction) {
					return adapter.transaction(async (txAdapter: DatabaseAdapter) => {
						return callback(buildTxQueryHelper(txAdapter));
					});
				}
				return callback(buildQueryHelper(contextApi));
			},
		};
	}

	/**
	 * Build a query helper backed by a raw DatabaseAdapter (used inside transactions).
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
			transaction: async <T>(callback: (q: EndpointQueryHelper) => Promise<T>): Promise<T> => {
				return callback(buildTxQueryHelper(txAdapter));
			},
		};
	}

	/**
	 * Safely read and parse the request body.
	 */
	async function safeReadBody(
		event: H3Event,
		utils: MomentumH3Utils,
		method: string,
	): Promise<Record<string, unknown>> {
		if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
			try {
				return await utils.readBody(event);
			} catch {
				return {};
			}
		}
		return {};
	}

	// ---- Main handler ----
	return async (event, utils, context) => {
		const method = event.method.toUpperCase();
		const user = context?.user;

		// Parse route segments from catch-all param
		const params = utils.getRouterParams(event);
		const pathSegments = (params['momentum'] ?? '').split('/').filter(Boolean);
		const queryParams = utils.getQuery(event);

		const seg0 = pathSegments[0] ?? '';
		const seg1 = pathSegments[1];
		const seg2 = pathSegments[2];
		const seg3 = pathSegments[3];

		// ============================================
		// GET /access
		// ============================================
		if (seg0 === 'access' && method === 'GET') {
			const permissions = await getCollectionPermissions(config, user);
			return { collections: permissions };
		}

		// ============================================
		// GraphQL: POST/GET /graphql
		// ============================================
		if (seg0 === 'graphql') {
			if (method === 'POST') {
				const rawBody = await safeReadBody(event, utils, method);
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
				const result = await executeGraphQL(graphqlSchema, body, { user });
				utils.setResponseStatus(event, result.status);
				return result.body;
			}
			if (method === 'GET') {
				const queryParam = queryParams['query'];
				if (typeof queryParam !== 'string') {
					utils.setResponseStatus(event, 400);
					return { errors: [{ message: 'Query parameter required' }] };
				}
				const result = await executeGraphQL(graphqlSchema, { query: queryParam }, { user });
				utils.setResponseStatus(event, result.status);
				return result.body;
			}
		}

		// ============================================
		// Globals: GET/PATCH /globals/:slug
		// ============================================
		if (seg0 === 'globals' && seg1) {
			const slug = seg1;
			const contextApi = getContextualAPI(user);

			if (method === 'GET') {
				try {
					const depthParam = queryParams['depth'];
					const depth = typeof depthParam === 'string' ? parseInt(depthParam, 10) || 0 : 0;
					const doc = await contextApi.global(slug).findOne({ depth });
					return { doc };
				} catch (error) {
					if (error instanceof GlobalNotFoundError) {
						utils.setResponseStatus(event, 404);
						return { error: sanitizeErrorMessage(error, 'Global not found') };
					}
					if (error instanceof Error && error.name === 'AccessDeniedError') {
						utils.setResponseStatus(event, 403);
						return { error: 'Access denied' };
					}
					utils.setResponseStatus(event, 500);
					return { error: sanitizeErrorMessage(error, 'Failed to read global') };
				}
			}

			if (method === 'PATCH') {
				try {
					const data = await safeReadBody(event, utils, method);
					const doc = await contextApi.global(slug).update(data);
					return { doc };
				} catch (error) {
					if (error instanceof GlobalNotFoundError) {
						utils.setResponseStatus(event, 404);
						return { error: sanitizeErrorMessage(error, 'Global not found') };
					}
					if (error instanceof Error && error.name === 'AccessDeniedError') {
						utils.setResponseStatus(event, 403);
						return { error: 'Access denied' };
					}
					if (error instanceof Error && error.name === 'ValidationError') {
						utils.setResponseStatus(event, 400);
						return { error: sanitizeErrorMessage(error, 'Validation failed') };
					}
					utils.setResponseStatus(event, 500);
					return { error: sanitizeErrorMessage(error, 'Failed to update global') };
				}
			}
		}

		// ============================================
		// Media: POST /media/upload
		// ============================================
		if (seg0 === 'media' && seg1 === 'upload' && method === 'POST') {
			if (!user) {
				utils.setResponseStatus(event, 401);
				return { error: 'Authentication required to upload files' };
			}

			const uploadConfig = getUploadConfig(config);
			if (!uploadConfig) {
				utils.setResponseStatus(event, 500);
				return { error: 'Storage not configured' };
			}

			const formData = await utils.readMultipartFormData(event);
			if (!formData || formData.length === 0) {
				utils.setResponseStatus(event, 400);
				return { error: 'No file provided' };
			}

			// Find the file field
			const fileField = formData.find((f) => f.name === 'file');
			if (!fileField || !fileField.filename) {
				utils.setResponseStatus(event, 400);
				return { error: 'No file provided' };
			}

			const file: UploadedFile = {
				originalName: fileField.filename,
				mimeType: fileField.type ?? 'application/octet-stream',
				size: fileField.data.length,
				buffer: fileField.data,
			};

			// Get alt text from form data if provided
			const altField = formData.find((f) => f.name === 'alt');
			const alt = altField ? altField.data.toString('utf-8') : undefined;

			const uploadRequest: UploadRequest = { file, user, alt };
			const response = await handleUpload(uploadConfig, uploadRequest);
			utils.setResponseStatus(event, response.status);
			return response;
		}

		// ============================================
		// Media: GET /media/file/*
		// ============================================
		if (seg0 === 'media' && seg1 === 'file' && method === 'GET') {
			const uploadConfig = getUploadConfig(config);
			if (!uploadConfig) {
				utils.setResponseStatus(event, 500);
				return { error: 'Storage not configured' };
			}

			const rawPath = pathSegments.slice(2).join('/');
			if (!rawPath) {
				utils.setResponseStatus(event, 400);
				return { error: 'File path required' };
			}

			// Sanitize path to prevent directory traversal
			const { normalize, isAbsolute, resolve, sep } = await import('node:path');
			let decodedPath: string;
			try {
				decodedPath = decodeURIComponent(rawPath);
			} catch {
				utils.setResponseStatus(event, 400);
				return { error: 'Invalid path encoding' };
			}
			const filePath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
			if (isAbsolute(filePath) || filePath.includes('..') || filePath.includes(`${sep}..`)) {
				utils.setResponseStatus(event, 403);
				return { error: 'Invalid file path' };
			}
			const fakeRoot = resolve('/safe-root');
			const resolved = resolve(fakeRoot, filePath);
			if (!resolved.startsWith(fakeRoot + sep) && resolved !== fakeRoot) {
				utils.setResponseStatus(event, 403);
				return { error: 'Invalid file path' };
			}

			const result = await handleFileGet(uploadConfig.adapter, filePath);
			if (!result) {
				utils.setResponseStatus(event, 404);
				return { error: 'File not found' };
			}

			if (result.mimeType) {
				utils.setResponseHeader(event, 'Content-Type', result.mimeType);
			}
			utils.setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000');
			return utils.send(event, result.buffer);
		}

		// ============================================
		// Version routes: /:collection/:id/versions/*
		// Must be checked before generic /:collection/:id
		// ============================================
		if (seg2 === 'versions' && seg1) {
			const collectionSlug = seg0;
			const docId = seg1;
			const contextApi = getContextualAPI(user);

			// POST /:collection/:id/versions/restore
			if (seg3 === 'restore' && method === 'POST') {
				try {
					const versionOps = contextApi.collection(collectionSlug).versions();
					if (!versionOps) {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Versioning not enabled',
							message: `Collection "${collectionSlug}" does not have versioning enabled`,
						};
					}
					const body = await safeReadBody(event, utils, method);
					const versionId = body['versionId'];
					if (typeof versionId !== 'string') {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Invalid request',
							message: 'versionId is required in request body',
						};
					}
					const restored = await versionOps.restore({
						versionId,
						publish: body['publish'] === true,
					});
					return { doc: restored, message: 'Version restored successfully' };
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return {
						error: 'Failed to restore version',
						message: sanitizeErrorMessage(error, 'Unknown error'),
					};
				}
			}

			// POST /:collection/:id/versions/compare
			if (seg3 === 'compare' && method === 'POST') {
				try {
					const versionOps = contextApi.collection(collectionSlug).versions();
					if (!versionOps) {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Versioning not enabled',
							message: `Collection "${collectionSlug}" does not have versioning enabled`,
						};
					}
					const body = await safeReadBody(event, utils, method);
					const versionId1 = body['versionId1'];
					const versionId2 = body['versionId2'];
					if (typeof versionId1 !== 'string' || typeof versionId2 !== 'string') {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Missing version IDs',
							message: 'Both versionId1 and versionId2 are required',
						};
					}
					const differences = await versionOps.compare(
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- string validated above
						versionId1 as string,
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- string validated above
						versionId2 as string,
					);
					return { differences };
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return {
						error: 'Failed to compare versions',
						message: sanitizeErrorMessage(error, 'Unknown error'),
					};
				}
			}

			// GET /:collection/:id/versions/:versionId
			if (seg3 && method === 'GET') {
				try {
					const versionOps = contextApi.collection(collectionSlug).versions();
					if (!versionOps) {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Versioning not enabled',
							message: `Collection "${collectionSlug}" does not have versioning enabled`,
						};
					}
					const version = await versionOps.findVersionById(seg3);
					if (!version) {
						utils.setResponseStatus(event, 404);
						return {
							error: 'Version not found',
							message: `Version "${seg3}" not found`,
						};
					}
					return version;
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return {
						error: 'Failed to fetch version',
						message: sanitizeErrorMessage(error, 'Unknown error'),
					};
				}
			}

			// GET /:collection/:id/versions (list)
			if (!seg3 && method === 'GET') {
				try {
					const versionOps = contextApi.collection(collectionSlug).versions();
					if (!versionOps) {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Versioning not enabled',
							message: `Collection "${collectionSlug}" does not have versioning enabled`,
						};
					}
					const result = await versionOps.findVersions(docId, {
						limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
						page: queryParams['page'] ? Number(queryParams['page']) : undefined,
						includeAutosave: queryParams['includeAutosave'] === 'true',
					});
					return result;
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return {
						error: 'Failed to fetch versions',
						message: sanitizeErrorMessage(error, 'Unknown error'),
					};
				}
			}
		}

		// ============================================
		// Publishing routes: /:collection/:id/publish|unpublish|draft|schedule-publish|cancel-scheduled-publish
		// ============================================
		if (seg1 && seg2 && method === 'POST') {
			const collectionSlug = seg0;
			const docId = seg1;
			const action = seg2;
			const contextApi = getContextualAPI(user);

			if (
				action === 'publish' ||
				action === 'unpublish' ||
				action === 'draft' ||
				action === 'schedule-publish' ||
				action === 'cancel-scheduled-publish'
			) {
				try {
					const versionOps = contextApi.collection(collectionSlug).versions();
					if (!versionOps) {
						utils.setResponseStatus(event, 400);
						return {
							error: 'Versioning not enabled',
							message: `Collection "${collectionSlug}" does not have versioning enabled`,
						};
					}

					if (action === 'publish') {
						const published = await versionOps.publish(docId);
						return { doc: published, message: 'Document published successfully' };
					}

					if (action === 'unpublish') {
						const unpublished = await versionOps.unpublish(docId);
						return {
							doc: unpublished,
							message: 'Document unpublished successfully',
						};
					}

					if (action === 'draft') {
						const body = await safeReadBody(event, utils, method);
						const draft = await versionOps.saveDraft(docId, body);
						return { version: draft, message: 'Draft saved successfully' };
					}

					if (action === 'schedule-publish') {
						const body = await safeReadBody(event, utils, method);
						const publishAt = body['publishAt'];
						if (typeof publishAt !== 'string') {
							utils.setResponseStatus(event, 400);
							return {
								error: 'Missing publishAt',
								message: 'A publishAt ISO date string is required',
							};
						}
						const result = await versionOps.schedulePublish(docId, publishAt);
						return result;
					}

					if (action === 'cancel-scheduled-publish') {
						await versionOps.cancelScheduledPublish(docId);
						return { message: 'Scheduled publish cancelled' };
					}
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return {
						error: `Failed to ${action.replace(/-/g, ' ')}`,
						message: sanitizeErrorMessage(error, 'Unknown error'),
					};
				}
			}

			// POST /:collection/:id/restore (soft-delete restore)
			if (action === 'restore') {
				if (isManagedCollection(collectionSlug)) {
					utils.setResponseStatus(event, 403);
					return { error: 'Managed collection is read-only' };
				}
				const request: MomentumRequest = {
					method: 'POST',
					collectionSlug,
					id: docId,
					user,
				};
				const response = await handlers.handleRestore(request);
				utils.setResponseStatus(event, response.status ?? 200);
				return response;
			}
		}

		// ============================================
		// Status: GET /:collection/:id/status
		// ============================================
		if (seg2 === 'status' && seg1 && method === 'GET') {
			const collectionSlug = seg0;
			const docId = seg1;
			const contextApi = getContextualAPI(user);

			try {
				const versionOps = contextApi.collection(collectionSlug).versions();
				if (!versionOps) {
					utils.setResponseStatus(event, 400);
					return {
						error: 'Versioning not enabled',
						message: `Collection "${collectionSlug}" does not have versioning enabled`,
					};
				}
				const status = await versionOps.getStatus(docId);
				return { status };
			} catch (error) {
				utils.setResponseStatus(event, 500);
				return {
					error: 'Failed to get status',
					message: sanitizeErrorMessage(error, 'Unknown error'),
				};
			}
		}

		// ============================================
		// Preview: GET /:collection/:id/preview
		// ============================================
		if (seg2 === 'preview' && seg1 && method === 'GET') {
			try {
				const collectionSlug = seg0;
				const docId = seg1;
				const contextApi = getContextualAPI(user);

				const doc = await contextApi.collection(collectionSlug).findById(docId);
				if (!doc) {
					utils.setResponseStatus(event, 404);
					return { error: 'Document not found' };
				}

				const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
				if (!collectionConfig) {
					utils.setResponseStatus(event, 404);
					return { error: 'Collection not found' };
				}

				const html = renderPreviewHTML({
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- doc type from API
					doc: doc as Record<string, unknown>,
					collection: collectionConfig,
				});
				utils.setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
				return utils.send(event, html);
			} catch (error) {
				const message = sanitizeErrorMessage(error, 'Unknown error');
				if (message.includes('Access denied')) {
					utils.setResponseStatus(event, 403);
					return { error: message };
				}
				if (message.includes('not found')) {
					utils.setResponseStatus(event, 404);
					return { error: message };
				}
				utils.setResponseStatus(event, 500);
				return { error: 'Preview failed', message };
			}
		}

		// ============================================
		// Custom Collection Endpoints
		// Check BEFORE generic routes so custom paths don't get swallowed
		// ============================================
		if (seg0 && seg1 && !seg2) {
			// Check if seg1 matches a custom endpoint path for this collection
			const customKey = `${method}:${seg0}/${seg1}`;
			const customEntry = customEndpointMap.get(customKey);
			if (customEntry) {
				try {
					const contextApi = getContextualAPI(user);
					const body = await safeReadBody(event, utils, method);
					const result = await customEntry.endpoint.handler({
						req: { user },
						collection: customEntry.collection,
						body,
						query: buildQueryHelper(contextApi),
					});
					utils.setResponseStatus(event, result.status);
					return result.body;
				} catch (error) {
					utils.setResponseStatus(event, 500);
					return { error: sanitizeErrorMessage(error, 'Custom endpoint error') };
				}
			}
		}

		// ============================================
		// Batch: POST /:collection/batch
		// ============================================
		if (seg1 === 'batch' && !seg2 && method === 'POST') {
			const collectionSlug = seg0;
			if (isManagedCollection(collectionSlug)) {
				utils.setResponseStatus(event, 403);
				return { error: 'Managed collection is read-only' };
			}
			try {
				const contextApi = getContextualAPI(user);
				const body = await safeReadBody(event, utils, method);
				const operation = body['operation'];

				if (operation === 'create') {
					const items = body['items'];
					if (!Array.isArray(items)) {
						utils.setResponseStatus(event, 400);
						return { error: 'items must be an array' };
					}
					if (items.length > MAX_BATCH_SIZE) {
						utils.setResponseStatus(event, 400);
						return {
							error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
						};
					}
					const docs = await contextApi.collection(collectionSlug).batchCreate(items);
					utils.setResponseStatus(event, 201);
					return { docs, message: `${docs.length} documents created` };
				} else if (operation === 'update') {
					const items = body['items'];
					if (!Array.isArray(items)) {
						utils.setResponseStatus(event, 400);
						return { error: 'items must be an array' };
					}
					if (items.length > MAX_BATCH_SIZE) {
						utils.setResponseStatus(event, 400);
						return {
							error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
						};
					}
					const docs = await contextApi.collection(collectionSlug).batchUpdate(items);
					return { docs, message: `${docs.length} documents updated` };
				} else if (operation === 'delete') {
					const ids = body['ids'];
					if (!Array.isArray(ids)) {
						utils.setResponseStatus(event, 400);
						return { error: 'ids must be an array' };
					}
					if (ids.length > MAX_BATCH_SIZE) {
						utils.setResponseStatus(event, 400);
						return {
							error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
						};
					}
					const results = await contextApi.collection(collectionSlug).batchDelete(ids);
					return { results, message: `${results.length} documents deleted` };
				} else {
					utils.setResponseStatus(event, 400);
					return {
						error: 'Invalid operation',
						message: 'operation must be "create", "update", or "delete"',
					};
				}
			} catch (error) {
				const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
				utils.setResponseStatus(event, status);
				return { error: sanitizeErrorMessage(error, 'Batch operation failed') };
			}
		}

		// ============================================
		// Search: GET /:collection/search
		// ============================================
		if (seg1 === 'search' && !seg2 && method === 'GET') {
			const fieldsParam = queryParams['fields'];
			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: seg0,
				query: {
					q: typeof queryParams['q'] === 'string' ? queryParams['q'] : '',
					fields: typeof fieldsParam === 'string' ? fieldsParam : undefined,
					limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
					page: queryParams['page'] ? Number(queryParams['page']) : undefined,
				},
				user,
			};
			const response = await handlers.handleSearch(request);
			utils.setResponseStatus(event, response.status ?? 200);
			return response;
		}

		// ============================================
		// Export: GET /:collection/export
		// ============================================
		if (seg1 === 'export' && !seg2 && method === 'GET') {
			try {
				const collectionSlug = seg0;
				const contextApi = getContextualAPI(user);

				const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
				if (!collectionConfig) {
					utils.setResponseStatus(event, 404);
					return { error: `Collection "${collectionSlug}" not found` };
				}

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated below
				const format = (
					typeof queryParams['format'] === 'string' ? queryParams['format'] : 'json'
				) as ExportFormat;
				if (format !== 'json' && format !== 'csv') {
					utils.setResponseStatus(event, 400);
					return { error: 'Invalid format. Use "json" or "csv"' };
				}

				const limit = queryParams['limit'] ? Number(queryParams['limit']) : 10000;
				const result = await contextApi.collection(collectionSlug).find({ limit });
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				const docs = result.docs as Record<string, unknown>[];

				if (format === 'csv') {
					const exportResult = exportToCsv(docs, collectionConfig);
					utils.setResponseHeader(event, 'Content-Type', 'text/csv');
					utils.setResponseHeader(
						event,
						'Content-Disposition',
						`attachment; filename="${collectionSlug}-export.csv"`,
					);
					return utils.send(event, exportResult.data ?? '');
				} else {
					const exportResult = exportToJson(docs, collectionConfig);
					utils.setResponseHeader(
						event,
						'Content-Disposition',
						`attachment; filename="${collectionSlug}-export.json"`,
					);
					return {
						collection: collectionSlug,
						format: 'json',
						totalDocs: exportResult.totalDocs,
						docs: exportResult.docs,
					};
				}
			} catch (error) {
				utils.setResponseStatus(event, 500);
				return { error: sanitizeErrorMessage(error, 'Export failed') };
			}
		}

		// ============================================
		// Import: POST /:collection/import
		// ============================================
		if (seg1 === 'import' && !seg2 && method === 'POST') {
			const collectionSlug = seg0;
			if (isManagedCollection(collectionSlug)) {
				utils.setResponseStatus(event, 403);
				return { error: 'Managed collection is read-only' };
			}
			try {
				if (!user) {
					utils.setResponseStatus(event, 401);
					return { error: 'Authentication required to import data' };
				}

				const contextApi = getMomentumAPI().setContext({ user });

				const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
				if (!collectionConfig) {
					utils.setResponseStatus(event, 404);
					return { error: `Collection "${collectionSlug}" not found` };
				}

				const body = await safeReadBody(event, utils, method);
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated below
				const format = (
					typeof body['format'] === 'string' ? body['format'] : 'json'
				) as ExportFormat;

				let docsToImport: Record<string, unknown>[];
				let parseError: string | undefined;

				if (format === 'csv') {
					const csvData = body['data'];
					if (typeof csvData !== 'string') {
						utils.setResponseStatus(event, 400);
						return {
							error: 'CSV import requires "data" field with CSV string',
						};
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
					utils.setResponseStatus(event, 400);
					return { error: parseError };
				}

				if (docsToImport.length === 0) {
					utils.setResponseStatus(event, 400);
					return { error: 'No documents to import' };
				}

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
						result.errors.push({ index: i, message: errMsg, data: docsToImport[i] });
					}
				}

				const status = result.imported > 0 ? 200 : 400;
				utils.setResponseStatus(event, status);
				return result;
			} catch (error) {
				utils.setResponseStatus(event, 500);
				return { error: sanitizeErrorMessage(error, 'Import failed') };
			}
		}

		// ============================================
		// Standard CRUD Routes
		// ============================================
		const collectionSlug = seg0;
		const id = seg1;

		// Parse standard query params
		const sortParam = queryParams['sort'];
		const query = {
			limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
			page: queryParams['page'] ? Number(queryParams['page']) : undefined,
			sort: typeof sortParam === 'string' ? sortParam : undefined,
			depth: queryParams['depth'] ? Number(queryParams['depth']) : undefined,
			where: parseWhereParam(queryParams['where']),
			withDeleted: queryParams['withDeleted'] === 'true',
			onlyDeleted: queryParams['onlyDeleted'] === 'true',
		};

		// Write operations on managed collections are forbidden
		if (
			isManagedCollection(collectionSlug) &&
			(method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')
		) {
			utils.setResponseStatus(event, 403);
			return { error: 'Managed collection is read-only' };
		}

		// Force delete
		if (method === 'DELETE' && id && queryParams['force'] === 'true') {
			const request: MomentumRequest = {
				method: 'DELETE',
				collectionSlug,
				id,
				user,
			};
			const response = await handlers.handleForceDelete(request);
			utils.setResponseStatus(event, response.status ?? 200);
			return response;
		}

		// Parse body for write methods
		const body = await safeReadBody(event, utils, method);

		const request: MomentumRequest = {
			method: toMomentumMethod(method),
			collectionSlug,
			id,
			body,
			query,
			user,
		};

		const response = await handlers.routeRequest(request);
		utils.setResponseStatus(event, response.status ?? 200);
		return response;
	};
}

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
	handlePreviewRequest,
	buildGraphQLSchema,
	handleUpload,
	handleFileGet,
	handleCollectionUpload,
	getUploadConfig,
	handleExportRequest,
	handleImportRequest,
	generateOpenAPISpec,
	getSwaggerUIHTML,
	createAdapterApiKeyStore,
	generateApiKey,
	hashApiKey,
	getKeyPrefix,
	generateApiKeyId,
	type ApiKeyStore,
	type OpenAPIDocument,
	type MomentumRequest,
	type MomentumResponse,
	type UploadRequest,
	type CollectionUploadRequest,
	sanitizeErrorMessage,
	parseWhereParam,
	validateMimeType,
} from '@momentumcms/server-core';
import type {
	MomentumConfig,
	ResolvedMomentumConfig,
	UserContext,
	UploadedFile,
	EndpointQueryHelper,
	DatabaseAdapter,
} from '@momentumcms/core';
import { isUploadCollection } from '@momentumcms/core';

/**
 * Render a full email preview HTML from the doc's email blocks.
 * Returns a complete HTML document (the rendered email) — no field labels or generic wrapper.
 */
async function renderEmailPreviewHTML(
	doc: Record<string, unknown>,
	blocksFieldName: string,
): Promise<string> {
	// Import from the server-safe sub-path to avoid bundling Angular components
	// (which require the JIT compiler). juice is externalized via rollupConfig.external.
	const { renderEmailFromBlocks } = await import('@momentumcms/email/server');
	const blocks = doc[blocksFieldName];
	if (!Array.isArray(blocks) || blocks.length === 0) {
		return '<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#666;font-family:sans-serif"><p>No email blocks yet.</p></body></html>';
	}
	return renderEmailFromBlocks({ blocks });
}

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
export type SendFn = (event: H3Event, data: Buffer | Uint8Array | string, type?: string) => unknown;

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
	send(event: H3Event, data: Buffer | Uint8Array | string, type?: string): unknown;
}

// ============================================
// Shared Helpers
// ============================================

// sanitizeErrorMessage and parseWhereParam are imported from @momentumcms/server-core

/**
 * Convert flat bracket-style query params from h3/ufo into nested objects.
 * h3's getQuery returns { "where[title][equals]": "foo" } for bracket-style params,
 * but Express/qs returns { where: { title: { equals: "foo" } } }.
 * This helper normalizes the h3 format to match Express behavior.
 */
function nestBracketParams(flat: Record<string, string | string[]>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(flat)) {
		const bracketIdx = key.indexOf('[');
		if (bracketIdx === -1) {
			// No brackets — pass through as-is
			result[key] = value;
			continue;
		}

		const rootKey = key.slice(0, bracketIdx);
		const bracketPart = key.slice(bracketIdx);
		const parts: string[] = [];
		const bracketRegex = /\[([^\]]*)\]/g;
		let m: RegExpExecArray | null;
		while ((m = bracketRegex.exec(bracketPart)) !== null) {
			parts.push(m[1]);
		}

		if (parts.length === 0) {
			result[key] = value;
			continue;
		}

		// Build nested object
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		let current = (result[rootKey] ?? {}) as Record<string, unknown>;
		result[rootKey] = current;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (typeof current[part] !== 'object' || current[part] === null) {
				current[part] = {};
			}
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			current = current[part] as Record<string, unknown>;
		}
		current[parts[parts.length - 1]] = value;
	}

	return result;
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
 * import { createMomentumHandler } from '@momentumcms/server-analog';
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

		// Parse query params (h3/ufo doesn't nest bracket-style params like Express/qs)
		const queryParams = nestBracketParams(getQuery(event));
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

/**
 * Creates a comprehensive h3 event handler that mirrors all Express API routes.
 * Handles: access control, GraphQL, globals, versioning, publishing, media,
 * batch operations, search, import/export, custom endpoints, preview, and CRUD.
 *
 * Usage in Analog.js:
 * ```typescript
 * import { defineEventHandler, readBody, getQuery, getRouterParams,
 *   setResponseStatus, setResponseHeader, readMultipartFormData, send, getHeaders } from 'h3';
 * import { createComprehensiveMomentumHandler } from '@momentumcms/server-analog';
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
	let cachedOpenAPISpec: OpenAPIDocument | null = null;
	const apiKeyStore: ApiKeyStore = createAdapterApiKeyStore(config.db.adapter);

	/** Role hierarchy for permission checks. Lower index = higher privilege. */
	const ROLE_HIERARCHY = ['admin', 'editor', 'user', 'viewer'];

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
				try {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					return (await contextApi.collection(slug).findById(id)) as Record<string, unknown>;
				} catch (err) {
					if (err instanceof Error && err.name === 'DocumentNotFoundError') return null;
					throw err;
				}
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
		// h3/ufo doesn't nest bracket-style params like Express/qs
		const queryParams = nestBracketParams(utils.getQuery(event));

		const seg0 = pathSegments[0] ?? '';
		const seg1 = pathSegments[1];
		const seg2 = pathSegments[2];
		const seg3 = pathSegments[3];

		// ============================================
		// GET /access
		// ============================================
		if (seg0 === 'access' && method === 'GET') {
			const result = await handleAccessRequest({ config, user });
			utils.setResponseStatus(event, result.status);
			return result.body;
		}

		// ============================================
		// OpenAPI Docs: GET /docs, GET /docs/openapi.json
		// ============================================
		if (seg0 === 'docs' && method === 'GET') {
			if (seg1 === 'openapi.json') {
				if (!cachedOpenAPISpec) {
					cachedOpenAPISpec = generateOpenAPISpec(config);
				}
				utils.setResponseHeader(event, 'Cache-Control', 'public, max-age=3600');
				return cachedOpenAPISpec;
			}
			if (!seg1) {
				utils.setResponseHeader(event, 'Content-Type', 'text/html');
				return utils.send(event, getSwaggerUIHTML(), 'text/html');
			}
		}

		// ============================================
		// API Key Management: GET/POST /auth/api-keys, DELETE /auth/api-keys/:id
		// ============================================
		if (seg0 === 'auth' && seg1 === 'api-keys') {
			if (!user) {
				utils.setResponseStatus(event, 401);
				return { error: 'Unauthorized' };
			}

			// GET /auth/api-keys — list API keys
			if (method === 'GET' && !seg2) {
				try {
					const keys =
						user.role === 'admin'
							? await apiKeyStore.listAll()
							: await apiKeyStore.listByUser(String(user.id));
					return { keys };
				} catch {
					utils.setResponseStatus(event, 500);
					return { error: 'Failed to list API keys' };
				}
			}

			// POST /auth/api-keys — create a new API key
			if (method === 'POST' && !seg2) {
				// API keys cannot create other API keys
				if (String(user.id).startsWith('apikey:')) {
					utils.setResponseStatus(event, 403);
					return { error: 'API keys cannot create other API keys' };
				}

				const body = await safeReadBody(event, utils, method);
				const name = body['name'];
				if (!name || typeof name !== 'string' || name.trim().length === 0) {
					utils.setResponseStatus(event, 400);
					return { error: 'Name is required' };
				}

				const role = typeof body['role'] === 'string' ? body['role'] : 'user';
				const validRoles = ['admin', 'editor', 'user', 'viewer'];
				if (!validRoles.includes(role)) {
					utils.setResponseStatus(event, 400);
					return { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
				}

				// Non-admin users cannot create keys with a higher role than their own
				const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role ?? 'viewer');
				if (user.role !== 'admin' && userRoleIndex === -1) {
					utils.setResponseStatus(event, 403);
					return { error: 'Unknown role — cannot determine privileges' };
				}
				const requestedRoleIndex = ROLE_HIERARCHY.indexOf(role);
				if (user.role !== 'admin' && requestedRoleIndex < userRoleIndex) {
					utils.setResponseStatus(event, 403);
					return { error: 'Cannot create a key with higher privileges than your own role' };
				}

				// Validate expiresAt if provided
				let expiresAt: string | null = null;
				if (body['expiresAt'] != null) {
					const parsed = new Date(String(body['expiresAt']));
					if (isNaN(parsed.getTime())) {
						utils.setResponseStatus(event, 400);
						return { error: 'Invalid expiresAt date format. Use ISO 8601.' };
					}
					expiresAt = parsed.toISOString();
				}

				try {
					const key = generateApiKey();
					const id = generateApiKeyId();
					const now = new Date().toISOString();

					const createdId = await apiKeyStore.create({
						id,
						name: name.trim(),
						keyHash: hashApiKey(key),
						keyPrefix: getKeyPrefix(key),
						createdBy: String(user.id),
						role,
						expiresAt,
						createdAt: now,
						updatedAt: now,
					});

					utils.setResponseStatus(event, 201);
					return {
						id: createdId,
						name: name.trim(),
						key,
						keyPrefix: getKeyPrefix(key),
						role,
						expiresAt,
						createdAt: now,
					};
				} catch {
					utils.setResponseStatus(event, 500);
					return { error: 'Failed to create API key' };
				}
			}

			// DELETE /auth/api-keys/:id — delete an API key
			if (method === 'DELETE' && seg2) {
				const keyId = seg2;

				// Non-admin users can only delete their own keys
				if (user.role !== 'admin') {
					const existingKey = await apiKeyStore.findById(keyId);
					if (!existingKey) {
						utils.setResponseStatus(event, 404);
						return { error: 'API key not found' };
					}
					if (existingKey.createdBy !== String(user.id)) {
						// Return 404 (not 403) to prevent API key ID enumeration
						utils.setResponseStatus(event, 404);
						return { error: 'API key not found' };
					}
				}

				try {
					const deleted = await apiKeyStore.deleteById(keyId);
					if (deleted) {
						return { deleted: true };
					}
					utils.setResponseStatus(event, 404);
					return { error: 'API key not found' };
				} catch {
					utils.setResponseStatus(event, 500);
					return { error: 'Failed to delete API key' };
				}
			}
		}

		// ============================================
		// GraphQL: POST/GET /graphql
		// ============================================
		if (seg0 === 'graphql') {
			if (method === 'POST') {
				const rawBody = await safeReadBody(event, utils, method);
				const result = await handleGraphQLPostRequest(graphqlSchema, rawBody, user);
				utils.setResponseStatus(event, result.status);
				return result.body;
			}
			if (method === 'GET') {
				const result = await handleGraphQLGetRequest(graphqlSchema, queryParams['query'], user);
				utils.setResponseStatus(event, result.status);
				return result.body;
			}
		}

		// ============================================
		// Globals: GET/PATCH /globals/:slug
		// ============================================
		if (seg0 === 'globals' && seg1) {
			const slug = seg1;

			if (method === 'GET') {
				const depthParam = queryParams['depth'];
				const depth = typeof depthParam === 'string' ? parseInt(depthParam, 10) || 0 : 0;
				const result = await handleGetGlobalRequest({ slug, depth, user });
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			if (method === 'PATCH') {
				const data = await safeReadBody(event, utils, method);
				const result = await handleUpdateGlobalRequest({ slug, data, user });
				utils.setResponseStatus(event, result.status);
				return result.body;
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
			// Reject any path containing traversal sequences before normalization
			if (decodedPath.includes('..')) {
				utils.setResponseStatus(event, 403);
				return { error: 'Invalid file path' };
			}
			const filePath = normalize(decodedPath);
			if (isAbsolute(filePath)) {
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

			// POST /:collection/:id/versions/restore
			if (seg3 === 'restore' && method === 'POST') {
				const body = await safeReadBody(event, utils, method);
				const result = await handleRestoreVersionRequest({
					collectionSlug,
					id: docId,
					versionId: body['versionId'],
					publish: body['publish'],
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			// POST /:collection/:id/versions/compare
			if (seg3 === 'compare' && method === 'POST') {
				const body = await safeReadBody(event, utils, method);
				const result = await handleCompareVersionsRequest({
					collectionSlug,
					id: docId,
					versionId1: body['versionId1'],
					versionId2: body['versionId2'],
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			// GET /:collection/:id/versions/:versionId
			if (seg3 && method === 'GET') {
				const result = await handleGetVersionRequest({
					collectionSlug,
					versionId: seg3,
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			// GET /:collection/:id/versions (list)
			if (!seg3 && method === 'GET') {
				const result = await handleListVersionsRequest({
					collectionSlug,
					id: docId,
					limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
					page: queryParams['page'] ? Number(queryParams['page']) : undefined,
					includeAutosave: queryParams['includeAutosave'] === 'true',
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}
		}

		// ============================================
		// Preview: GET/POST /:collection/:id/preview
		// GET loads from DB, POST renders from request body (live preview)
		// Must be checked BEFORE the publishing guard, which catches all 3-segment POSTs.
		// ============================================
		if (seg2 === 'preview' && seg1 && (method === 'GET' || method === 'POST')) {
			const postBody = method === 'POST' ? await safeReadBody(event, utils, method) : undefined;
			const result = await handlePreviewRequest({
				config,
				collectionSlug: seg0,
				id: seg1,
				method,
				postBody,
				user,
				renderEmail: renderEmailPreviewHTML,
			});
			if (result.headers) {
				for (const [key, value] of Object.entries(result.headers)) {
					utils.setResponseHeader(event, key, value);
				}
			}
			utils.setResponseStatus(event, result.status);
			if (typeof result.body === 'string') {
				return utils.send(event, result.body);
			}
			return result.body;
		}

		// ============================================
		// Publishing routes: /:collection/:id/publish|unpublish|draft|schedule-publish|cancel-scheduled-publish
		// ============================================
		if (seg1 && seg2 && method === 'POST') {
			const collectionSlug = seg0;
			const docId = seg1;
			const action = seg2;

			if (action === 'publish') {
				const result = await handlePublishRequest({ collectionSlug, id: docId, user });
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			if (action === 'unpublish') {
				const result = await handleUnpublishRequest({ collectionSlug, id: docId, user });
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			if (action === 'draft') {
				const body = await safeReadBody(event, utils, method);
				const result = await handleSaveDraftRequest({
					collectionSlug,
					id: docId,
					data: body,
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			if (action === 'schedule-publish') {
				const body = await safeReadBody(event, utils, method);
				const result = await handleSchedulePublishRequest({
					collectionSlug,
					id: docId,
					publishAt: body['publishAt'],
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
			}

			if (action === 'cancel-scheduled-publish') {
				const result = await handleCancelScheduledPublishRequest({
					collectionSlug,
					id: docId,
					user,
				});
				utils.setResponseStatus(event, result.status);
				return result.body;
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

			// Unknown action — return 404 instead of falling through to CRUD
			utils.setResponseStatus(event, 404);
			return { error: 'Not found', message: `Unknown action "${action}"` };
		}

		// ============================================
		// Status: GET /:collection/:id/status
		// ============================================
		if (seg2 === 'status' && seg1 && method === 'GET') {
			const result = await handleStatusRequest({
				collectionSlug: seg0,
				id: seg1,
				user,
			});
			utils.setResponseStatus(event, result.status);
			return result.body;
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
			const body = await safeReadBody(event, utils, method);
			const result = await handleBatchRequest({
				config,
				collectionSlug: seg0,
				body,
				user,
			});
			utils.setResponseStatus(event, result.status);
			return result.body;
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
			const result = await handleExportRequest({
				collectionSlug: seg0,
				format: typeof queryParams['format'] === 'string' ? queryParams['format'] : 'json',
				limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
				user,
				config,
				api: getMomentumAPI(),
			});

			utils.setResponseStatus(event, result.status);
			if (result.headers) {
				for (const [key, value] of Object.entries(result.headers)) {
					utils.setResponseHeader(event, key, value);
				}
			}
			if (typeof result.body === 'string') {
				return utils.send(event, result.body);
			}
			return result.body;
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
			const body = await safeReadBody(event, utils, method);
			const result = await handleImportRequest({
				collectionSlug,
				format: body['format'] === 'csv' ? 'csv' : 'json',
				body,
				dryRun: body['dryRun'] === true,
				user,
				config: { collections: config.collections },
				api: getMomentumAPI(),
			});
			utils.setResponseStatus(event, result.status);
			return result.body;
		}

		// ============================================
		// Collection-level upload: POST /:collection (upload collections)
		// ============================================
		const postUploadCol = seg0 ? config.collections.find((c) => c.slug === seg0) : undefined;
		if (method === 'POST' && seg0 && !seg1 && postUploadCol && isUploadCollection(postUploadCol)) {
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
			const fields: Record<string, unknown> = {};
			for (const field of formData) {
				if (field.name !== 'file' && field.name) {
					fields[field.name] = field.data.toString('utf-8');
				}
			}
			const collectionUpload = postUploadCol.upload ?? {};
			const uploadRequest: CollectionUploadRequest = {
				file,
				user,
				fields,
				collectionSlug: seg0,
				collectionUpload,
			};
			const response = await handleCollectionUpload(uploadConfig, uploadRequest);
			utils.setResponseStatus(event, response.status);
			return response;
		}

		// ============================================
		// Collection-level PATCH with file: PATCH /:collection/:id (upload collections)
		// ============================================
		const patchUploadCol = seg0 ? config.collections.find((c) => c.slug === seg0) : undefined;
		if (
			method === 'PATCH' &&
			seg0 &&
			seg1 &&
			patchUploadCol &&
			isUploadCollection(patchUploadCol)
		) {
			// Auth check before parsing multipart (matches Express behavior)
			if (!user) {
				utils.setResponseStatus(event, 401);
				return { error: 'Authentication required to upload files' };
			}
			// Try to read multipart form data (returns undefined for non-multipart requests)
			const formData = await utils.readMultipartFormData(event);
			if (formData) {
				const uploadConfig = getUploadConfig(config);
				if (!uploadConfig) {
					utils.setResponseStatus(event, 500);
					return { error: 'Storage not configured' };
				}
				const fileField = formData.find((f) => f.name === 'file');
				if (fileField?.filename) {
					const file: UploadedFile = {
						originalName: fileField.filename,
						mimeType: fileField.type ?? 'application/octet-stream',
						size: fileField.data.length,
						buffer: fileField.data,
					};
					// Validate file size and MIME type
					const maxFileSize =
						patchUploadCol.upload?.maxFileSize ?? uploadConfig.maxFileSize ?? 10 * 1024 * 1024;
					const allowedMimeTypes =
						patchUploadCol.upload?.mimeTypes ?? uploadConfig.allowedMimeTypes ?? [];
					if (file.size > maxFileSize) {
						const maxMB = (maxFileSize / (1024 * 1024)).toFixed(1);
						utils.setResponseStatus(event, 400);
						return { error: `File too large. Maximum size is ${maxMB}MB` };
					}
					const mimeError = validateMimeType(file.mimeType, allowedMimeTypes);
					if (mimeError) {
						utils.setResponseStatus(event, 400);
						return { error: mimeError };
					}
					// Validate magic bytes
					if (file.buffer && file.buffer.length > 0) {
						const { validateMimeType: validateMimeByMagicBytes } = await import(
							'@momentumcms/storage'
						);
						const magicByteResult = validateMimeByMagicBytes(
							file.buffer,
							file.mimeType,
							allowedMimeTypes,
						);
						if (!magicByteResult.valid) {
							utils.setResponseStatus(event, 400);
							return {
								error: magicByteResult.error ?? 'File content does not match claimed type',
							};
						}
					}
					// Store file and update document
					const storedFile = await uploadConfig.adapter.upload(file);
					const fields: Record<string, unknown> = {};
					for (const field of formData ?? []) {
						if (field.name !== 'file' && field.name) {
							fields[field.name] = field.data.toString('utf-8');
						}
					}
					const updateData: Record<string, unknown> = {
						...fields,
						filename: file.originalName,
						mimeType: file.mimeType,
						filesize: file.size,
						path: storedFile.path,
						url: storedFile.url,
					};
					try {
						const api = getMomentumAPI().setContext({ user });
						const doc = await api.collection(seg0).update(seg1, updateData);
						return { doc };
					} catch (error) {
						utils.setResponseStatus(event, 500);
						return { error: sanitizeErrorMessage(error, 'Failed to update document') };
					}
				} else {
					// No file: standard JSON update with multipart fields
					const fields: Record<string, unknown> = {};
					for (const field of formData ?? []) {
						if (field.name) {
							fields[field.name] = field.data.toString('utf-8');
						}
					}
					const request: MomentumRequest = {
						method: 'PATCH',
						collectionSlug: seg0,
						id: seg1,
						body: fields,
						user,
					};
					const response = await handlers.routeRequest(request);
					utils.setResponseStatus(event, response.status ?? 200);
					return response;
				}
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

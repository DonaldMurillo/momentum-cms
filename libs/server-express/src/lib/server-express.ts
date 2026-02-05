import { Router, json as jsonParser } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
	createMomentumHandlers,
	getCollectionPermissions,
	getMomentumAPI,
	type MomentumRequest,
} from '@momentum-cms/server-core';
import type { MomentumConfig, ResolvedMomentumConfig, UserContext } from '@momentum-cms/core';

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
		res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
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
			const message = error instanceof Error ? error.message : 'Unknown error';
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
			const message = error instanceof Error ? error.message : 'Unknown error';
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
			const message = error instanceof Error ? error.message : 'Unknown error';
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
			const message = error instanceof Error ? error.message : 'Unknown error';
			res.status(500).json({ error: 'Failed to publish document', message });
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
			const message = error instanceof Error ? error.message : 'Unknown error';
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
			const message = error instanceof Error ? error.message : 'Unknown error';
			res.status(500).json({ error: 'Failed to save draft', message });
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
			const message = error instanceof Error ? error.message : 'Unknown error';
			res.status(500).json({ error: 'Failed to get status', message });
		}
	});

	// ============================================
	// Standard Collection Routes
	// ============================================

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

import { Router, json as jsonParser } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
	createMomentumHandlers,
	getCollectionPermissions,
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

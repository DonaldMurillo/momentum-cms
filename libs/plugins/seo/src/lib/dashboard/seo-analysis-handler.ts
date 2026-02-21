/**
 * SEO Analysis Dashboard Handler
 *
 * Read-only Express endpoint for the admin dashboard to fetch
 * SEO analysis data. Requires admin authentication.
 *
 * The seo-analysis collection is `managed: true` (no auto-generated
 * REST routes), so this handler provides the only HTTP read path.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { MomentumAPI } from '@momentumcms/plugins/core';

export interface DashboardHandlerOptions {
	getApi: () => MomentumAPI | null;
}

interface CollectionFindApi {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
}

/**
 * Type-safe check for admin user on the request.
 * Uses type guards instead of `as` assertions per CLAUDE.md.
 */
function isAdminUser(req: Request): boolean {
	if (!('user' in req)) return false;
	const user: unknown = req['user'];
	return user != null && typeof user === 'object' && 'role' in user && user['role'] === 'admin';
}

/**
 * Creates an Express router for the SEO dashboard read endpoint.
 */
export function createDashboardRouter(options: DashboardHandlerOptions): Router {
	const { getApi } = options;
	const router = createRouter();

	router.get('/analyses', async (req: Request, res: Response) => {
		if (!isAdminUser(req)) {
			res.status(401).json({ error: 'Admin access required' });
			return;
		}

		const api = getApi();
		if (!api) {
			res.status(503).json({ error: 'API not ready' });
			return;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
			const analysisApi = api.collection('seo-analysis') as CollectionFindApi;

			if (!analysisApi.find) {
				res.status(503).json({ error: 'Collection not available' });
				return;
			}

			const limit = Math.min(Number(req.query['limit']) || 500, 1000);
			const sort = String(req.query['sort'] || '-analyzedAt');

			const result = await analysisApi.find({ limit, sort });
			res.json(result);
		} catch {
			res.status(500).json({ error: 'Failed to fetch analyses' });
		}
	});

	return router;
}

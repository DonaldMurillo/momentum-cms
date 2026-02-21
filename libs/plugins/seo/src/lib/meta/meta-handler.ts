/**
 * Meta Tag API Express Handler
 *
 * Serves JSON meta tags at /meta/:collection/:id.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import { extractSeoFieldData } from '../seo-utils';
import { buildMetaTags } from './meta-builder';

export interface MetaHandlerOptions {
	getApi: () => MomentumAPI | null;
	siteUrl?: string;
	seoCollections: string[];
}

interface CollectionFindByIdApi {
	findById?(id: string, opts?: unknown): Promise<Record<string, unknown> | null>;
}

/**
 * Type-safe check for admin user on the request.
 */
function isAdminUser(req: Request): boolean {
	if (!('user' in req)) return false;
	const user: unknown = req['user'];
	return user != null && typeof user === 'object' && 'role' in user && user['role'] === 'admin';
}

/**
 * Creates an Express router for the meta tag API.
 */
export function createMetaRouter(options: MetaHandlerOptions): Router {
	const { getApi, siteUrl, seoCollections } = options;
	const allowedCollections = new Set(seoCollections);
	const router = createRouter();

	router.get('/meta/:collection/:id', async (req: Request, res: Response) => {
		if (!isAdminUser(req)) {
			res.status(401).json({ error: 'Admin access required' });
			return;
		}

		const api = getApi();
		if (!api) {
			res.status(503).json({ error: 'API not ready' });
			return;
		}

		const { collection, id } = req.params;

		if (!allowedCollections.has(collection)) {
			res.status(404).json({ error: 'Collection not SEO-enabled' });
			return;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
			const collectionApi = api.collection(collection) as CollectionFindByIdApi;

			if (!collectionApi.findById) {
				res.status(404).json({ error: 'Collection not found' });
				return;
			}

			const doc = await collectionApi.findById(id, { depth: 1 });
			if (!doc) {
				res.status(404).json({ error: 'Document not found' });
				return;
			}

			const seoData = extractSeoFieldData(doc);
			const metaTags = buildMetaTags(doc, seoData, siteUrl);

			res.json(metaTags);
		} catch {
			res.status(500).json({ error: 'Failed to build meta tags' });
		}
	});

	return router;
}

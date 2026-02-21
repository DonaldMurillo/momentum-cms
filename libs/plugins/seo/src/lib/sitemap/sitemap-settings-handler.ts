/**
 * Sitemap Settings Express Handler
 *
 * CRUD endpoint for per-collection sitemap configuration.
 * Requires admin authentication. The seo-sitemap-settings collection
 * is `managed: true`, so this handler provides the only HTTP path.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { SitemapChangeFreq } from '../seo-config.types';

const VALID_CHANGE_FREQS = new Set<SitemapChangeFreq>([
	'always',
	'hourly',
	'daily',
	'weekly',
	'monthly',
	'yearly',
	'never',
]);

export interface SitemapSettingsHandlerOptions {
	getApi: () => MomentumAPI | null;
	seoCollections: string[];
	onSettingsChanged?: () => void;
}

interface CollectionApi {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
	create?(data: Record<string, unknown>): Promise<Record<string, unknown>>;
	update?(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
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
 * Creates an Express router for sitemap settings CRUD.
 */
export function createSitemapSettingsRouter(options: SitemapSettingsHandlerOptions): Router {
	const { getApi, seoCollections, onSettingsChanged } = options;
	const router = createRouter();

	/**
	 * GET /sitemap-settings
	 *
	 * Returns a merged list of all SEO-enabled collections with their
	 * sitemap settings. Collections without saved settings get defaults.
	 */
	router.get('/sitemap-settings', async (req: Request, res: Response) => {
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
			const settingsApi = api.collection('seo-sitemap-settings') as CollectionApi;
			if (!settingsApi.find) {
				res.status(503).json({ error: 'Collection not available' });
				return;
			}

			const result = await settingsApi.find({ limit: 0 });
			const settingsMap = new Map<string, Record<string, unknown>>();
			for (const doc of result.docs) {
				if (typeof doc['collection'] === 'string') {
					settingsMap.set(doc['collection'], doc);
				}
			}

			const settings = seoCollections.map((slug) => {
				const saved = settingsMap.get(slug);
				return {
					collection: slug,
					includeInSitemap: saved ? saved['includeInSitemap'] !== false : true,
					priority: saved && saved['priority'] != null ? Number(saved['priority']) : null,
					changeFreq: saved ? (saved['changeFreq'] ?? null) : null,
					id: saved ? saved['id'] : null,
				};
			});

			res.json({ settings });
		} catch {
			res.status(500).json({ error: 'Failed to fetch sitemap settings' });
		}
	});

	/**
	 * PUT /sitemap-settings/:collection
	 *
	 * Upsert sitemap settings for a single collection.
	 * Creates a new row if none exists, updates if found.
	 */
	router.put('/sitemap-settings/:collection', async (req: Request, res: Response) => {
		if (!isAdminUser(req)) {
			res.status(401).json({ error: 'Admin access required' });
			return;
		}

		const collectionSlug = req.params['collection'];
		if (!collectionSlug || !seoCollections.includes(collectionSlug)) {
			res.status(400).json({ error: 'Invalid collection slug' });
			return;
		}

		const api = getApi();
		if (!api) {
			res.status(503).json({ error: 'API not ready' });
			return;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
			const settingsApi = api.collection('seo-sitemap-settings') as CollectionApi;
			if (!settingsApi.find || !settingsApi.create || !settingsApi.update) {
				res.status(503).json({ error: 'Collection not available' });
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request body typing
			const body = req.body as Record<string, unknown>;
			const data: Record<string, unknown> = {
				collection: collectionSlug,
			};

			if ('includeInSitemap' in body) {
				data['includeInSitemap'] = body['includeInSitemap'] === true;
			}
			if ('priority' in body && body['priority'] != null) {
				data['priority'] = Math.max(0, Math.min(1, Number(body['priority'])));
			}
			if ('changeFreq' in body) {
				const freq = String(body['changeFreq']);
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validating against known set
				if (!VALID_CHANGE_FREQS.has(freq as SitemapChangeFreq)) {
					res.status(400).json({ error: 'Invalid changeFreq value' });
					return;
				}
				data['changeFreq'] = freq;
			}

			// Find existing row for this collection
			const existing = await settingsApi.find({
				where: { collection: { equals: collectionSlug } },
				limit: 1,
			});

			let result: Record<string, unknown>;
			if (existing.docs.length > 0 && typeof existing.docs[0]['id'] === 'string') {
				result = await settingsApi.update(existing.docs[0]['id'], data);
			} else {
				result = await settingsApi.create(data);
			}

			if (onSettingsChanged) {
				onSettingsChanged();
			}

			res.json(result);
		} catch {
			res.status(500).json({ error: 'Failed to update sitemap settings' });
		}
	});

	return router;
}

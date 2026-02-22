/**
 * Sitemap Express Handler
 *
 * Serves XML sitemaps at /sitemap.xml with in-memory caching.
 * Reads per-collection settings from the seo-sitemap-settings collection
 * and per-document exclusions from the SEO field group.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { SitemapConfig } from '../seo-config.types';
import { extractSeoFieldData } from '../seo-utils';
import { generateSitemap } from './sitemap-generator';
import type { SitemapEntry } from './sitemap-generator';
import { SitemapCache } from './sitemap-cache';

export interface SitemapHandlerOptions {
	getApi: () => MomentumAPI | null;
	siteUrl: string;
	config: SitemapConfig;
	seoCollections: string[];
}

interface CollectionFindApi {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
}

interface CollectionSitemapSettings {
	includeInSitemap: boolean;
	priority: number | null;
	changeFreq: string | null;
}

function resolveChangeFreq(config: SitemapConfig, slug: string): SitemapEntry['changefreq'] {
	return config.changeFreqs?.[slug] ?? config.defaultChangeFreq ?? 'weekly';
}

/**
 * Fetch per-collection sitemap settings from the DB.
 * Returns an empty map if the collection is not available (graceful degradation).
 */
async function fetchSitemapSettings(
	api: MomentumAPI,
): Promise<Map<string, CollectionSitemapSettings>> {
	const map = new Map<string, CollectionSitemapSettings>();
	try {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
		const settingsApi = api.collection('seo-sitemap-settings') as CollectionFindApi;
		if (!settingsApi.find) return map;

		const result = await settingsApi.find({ limit: 0 });
		for (const doc of result.docs) {
			if (typeof doc['collection'] === 'string') {
				map.set(doc['collection'], {
					includeInSitemap: doc['includeInSitemap'] !== false,
					priority: doc['priority'] != null ? Number(doc['priority']) : null,
					changeFreq: typeof doc['changeFreq'] === 'string' ? doc['changeFreq'] : null,
				});
			}
		}
	} catch {
		// Gracefully degrade — use static config if settings collection unavailable
	}
	return map;
}

/**
 * Creates an Express router for the sitemap endpoint.
 */
export function createSitemapRouter(options: SitemapHandlerOptions): {
	router: Router;
	clearCache: () => void;
} {
	const { getApi, siteUrl, config, seoCollections } = options;
	const cache = new SitemapCache(config.cacheTtl ?? 300_000);
	const router = createRouter();

	router.get('/sitemap.xml', async (req: Request, res: Response) => {
		const api = getApi();
		if (!api) {
			res.status(503).json({ error: 'API not ready' });
			return;
		}

		// Use the request origin so URLs match the server the crawler is hitting.
		// siteUrl from config is only a fallback when Host header is missing.
		const host = req.get('host');
		const effectiveSiteUrl = host ? `${req.protocol}://${host}` : siteUrl || 'http://localhost';

		const cached = cache.get('sitemap');
		if (cached) {
			res.set('Content-Type', 'application/xml');
			res.send(cached);
			return;
		}

		try {
			const entries: SitemapEntry[] = [];
			const collections = config.includeCollections ?? seoCollections;

			// Load per-collection sitemap settings from DB
			const settingsMap = await fetchSitemapSettings(api);

			for (const slug of collections) {
				if (config.excludeCollections?.includes(slug)) continue;

				// Check collection-level DB settings
				const collSettings = settingsMap.get(slug);
				if (collSettings?.includeInSitemap === false) continue;

				try {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
					const collectionApi = api.collection(slug) as CollectionFindApi;
					if (!collectionApi.find) continue;

					const result = await collectionApi.find({ limit: 0 });
					for (const doc of result.docs) {
						const seoData = extractSeoFieldData(doc);

						// Skip documents marked noIndex or explicitly excluded from sitemap
						if (seoData.noIndex) continue;
						if (seoData.excludeFromSitemap) continue;

						const identifier = typeof doc['slug'] === 'string' ? doc['slug'] : String(doc['id']);
						const loc = config.urlBuilder
							? config.urlBuilder(slug, doc)
							: `${effectiveSiteUrl}/${slug}/${identifier}`;

						if (!loc) continue;

						// Priority: DB setting > static config > default
						const priority =
							(collSettings?.priority != null ? collSettings.priority : null) ??
							config.priorities?.[slug] ??
							config.defaultPriority ??
							0.5;

						// Change freq: DB setting > static config > default
						const changefreq =
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB string narrowed to changefreq union
							(collSettings?.changeFreq as SitemapEntry['changefreq'] | undefined) ??
							resolveChangeFreq(config, slug);

						entries.push({
							loc,
							lastmod: typeof doc['updatedAt'] === 'string' ? doc['updatedAt'] : undefined,
							changefreq,
							priority,
						});
					}
				} catch {
					// Skip collections that fail to query (e.g. auth-managed collections)
				}
			}

			const xml = generateSitemap(entries);
			cache.set('sitemap', xml);
			res.set('Content-Type', 'application/xml');
			res.send(xml);
		} catch {
			res.status(500).json({ error: 'Failed to generate sitemap' });
		}
	});

	return { router, clearCache: () => cache.clear() };
}

/**
 * Expose cache for shutdown cleanup.
 */
export { SitemapCache };

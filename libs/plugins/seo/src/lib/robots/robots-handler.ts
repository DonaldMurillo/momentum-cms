/**
 * Robots.txt Express Handler
 *
 * Serves robots.txt based on plugin configuration.
 * When `getApi` is provided, reads settings from the seo-settings
 * managed collection; falls back to the static config.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { RobotsConfig, RobotsRule } from '../seo-config.types';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import { SitemapCache } from '../sitemap/sitemap-cache';
import { generateRobotsTxt } from './robots-txt-generator';

export { generateRobotsTxt } from './robots-txt-generator';

export interface RobotsHandlerOptions {
	siteUrl: string;
	config: RobotsConfig;
	/** When provided, robots.txt is read from the seo-settings collection. */
	getApi?: () => MomentumAPI | null;
}

const CACHE_KEY = 'robots-txt';

interface CollectionApi {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
}

/**
 * Read robots config from the seo-settings managed collection.
 * Returns null if no saved settings exist.
 */
async function readSettingsFromDb(api: MomentumAPI): Promise<RobotsConfig | null> {
	try {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
		const settingsApi = api.collection('seo-settings') as CollectionApi;
		if (!settingsApi.find) return null;

		const result = await settingsApi.find({ limit: 1 });
		if (result.docs.length === 0) return null;

		const doc = result.docs[0];
		return {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic DB document shape
			rules: (doc['robotsRules'] as RobotsRule[] | undefined) ?? undefined,
			crawlDelay: doc['robotsCrawlDelay'] != null ? Number(doc['robotsCrawlDelay']) : undefined,
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic DB document shape
			additionalSitemaps: (doc['robotsAdditionalSitemaps'] as string[] | undefined) ?? undefined,
		};
	} catch {
		return null;
	}
}

/**
 * Creates an Express router for the robots.txt endpoint.
 *
 * Returns `{ router, clearCache }` so the plugin can invalidate the
 * cached response when settings change.
 */
export function createRobotsRouter(options: RobotsHandlerOptions): {
	router: Router;
	clearCache: () => void;
} {
	const { siteUrl, config, getApi } = options;
	const cache = new SitemapCache(300_000); // 5 min TTL

	const router = createRouter();

	router.get('/robots.txt', async (req: Request, res: Response) => {
		// Try cached version first
		const cached = cache.get(CACHE_KEY);
		if (cached) {
			res.set('Content-Type', 'text/plain');
			res.send(cached);
			return;
		}

		// Use the request origin so URLs match the server the crawler is hitting.
		// siteUrl from config is only a fallback when Host header is missing.
		const host = req.get('host');
		const effectiveSiteUrl = host ? `${req.protocol}://${host}` : siteUrl || 'http://localhost';

		let effectiveConfig = config;

		// Try reading from DB when API is available
		if (getApi) {
			const api = getApi();
			if (api) {
				const dbConfig = await readSettingsFromDb(api);
				if (dbConfig) {
					effectiveConfig = dbConfig;
				}
			}
		}

		const content = generateRobotsTxt(effectiveSiteUrl, effectiveConfig);
		cache.set(CACHE_KEY, content);
		res.set('Content-Type', 'text/plain');
		res.send(content);
	});

	return {
		router,
		clearCache: (): void => {
			cache.clear();
		},
	};
}

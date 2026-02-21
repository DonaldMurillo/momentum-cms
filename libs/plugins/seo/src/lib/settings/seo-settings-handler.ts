/**
 * SEO Settings Express Handler
 *
 * GET/PUT endpoint for the site-wide SEO settings singleton.
 * Requires admin authentication. The seo-settings collection is
 * `managed: true`, so this handler provides the only HTTP path.
 */

import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { RobotsConfig } from '../seo-config.types';

export interface SeoSettingsHandlerOptions {
	getApi: () => MomentumAPI | null;
	/** Static robots config from plugin init — used as defaults. */
	defaultRobotsConfig?: RobotsConfig;
	/** Called when settings are saved — invalidate caches. */
	onSettingsChanged?: () => void;
}

interface CollectionApi {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
	create?(data: Record<string, unknown>): Promise<Record<string, unknown>>;
	update?(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Default robots rules when no saved settings and no static config. */
const DEFAULT_RULES = [{ userAgent: '*', allow: ['/'], disallow: [] }];

/**
 * Type-safe check for admin user on the request.
 */
function isAdminUser(req: Request): boolean {
	if (!('user' in req)) return false;
	const user: unknown = req['user'];
	return user != null && typeof user === 'object' && 'role' in user && user['role'] === 'admin';
}

/**
 * Creates an Express router for SEO settings CRUD (singleton).
 */
export function createSeoSettingsRouter(options: SeoSettingsHandlerOptions): Router {
	const { getApi, defaultRobotsConfig, onSettingsChanged } = options;
	const router = createRouter();

	/**
	 * GET /seo-settings
	 *
	 * Returns the current SEO settings. If no saved settings exist,
	 * returns defaults derived from the static plugin config.
	 */
	router.get('/seo-settings', async (req: Request, res: Response) => {
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
			const settingsApi = api.collection('seo-settings') as CollectionApi;
			if (!settingsApi.find) {
				res.status(503).json({ error: 'Collection not available' });
				return;
			}

			const result = await settingsApi.find({ limit: 1 });
			if (result.docs.length > 0) {
				res.json(result.docs[0]);
				return;
			}

			// No saved settings — return defaults from static config
			const defaultRules = defaultRobotsConfig?.rules ?? DEFAULT_RULES;
			res.json({
				robotsRules: defaultRules,
				robotsCrawlDelay: defaultRobotsConfig?.crawlDelay ?? null,
				robotsAdditionalSitemaps: defaultRobotsConfig?.additionalSitemaps ?? [],
			});
		} catch {
			res.status(500).json({ error: 'Failed to fetch SEO settings' });
		}
	});

	/**
	 * PUT /seo-settings
	 *
	 * Upsert the SEO settings singleton document.
	 */
	router.put('/seo-settings', async (req: Request, res: Response) => {
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
			const settingsApi = api.collection('seo-settings') as CollectionApi;
			if (!settingsApi.find || !settingsApi.create || !settingsApi.update) {
				res.status(503).json({ error: 'Collection not available' });
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request body typing
			const body = req.body as Record<string, unknown>;
			const data: Record<string, unknown> = {};

			if ('robotsRules' in body) {
				if (!Array.isArray(body['robotsRules'])) {
					res.status(400).json({ error: 'robotsRules must be an array' });
					return;
				}
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated as array above
				data['robotsRules'] = (body['robotsRules'] as Array<Record<string, unknown>>).map(
					(rule) => ({
						userAgent: String(rule['userAgent'] ?? '*').replace(/[\r\n]/g, ''),
						allow: Array.isArray(rule['allow'])
							? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated as array above
								(rule['allow'] as string[]).map((p) => String(p).replace(/[\r\n]/g, ''))
							: [],
						disallow: Array.isArray(rule['disallow'])
							? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated as array above
								(rule['disallow'] as string[]).map((p) => String(p).replace(/[\r\n]/g, ''))
							: [],
					}),
				);
			}
			if ('robotsCrawlDelay' in body) {
				const delay = body['robotsCrawlDelay'];
				data['robotsCrawlDelay'] = delay != null ? Math.max(0, Number(delay)) : null;
			}
			if ('robotsAdditionalSitemaps' in body) {
				if (!Array.isArray(body['robotsAdditionalSitemaps'])) {
					res.status(400).json({ error: 'robotsAdditionalSitemaps must be an array' });
					return;
				}
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated as array above
				data['robotsAdditionalSitemaps'] = (body['robotsAdditionalSitemaps'] as string[]).map((s) =>
					String(s).replace(/[\r\n]/g, ''),
				);
			}

			// Find existing singleton
			const existing = await settingsApi.find({ limit: 1 });

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
			res.status(500).json({ error: 'Failed to update SEO settings' });
		}
	});

	return router;
}

/**
 * SEO Plugin
 *
 * A Momentum CMS plugin for SEO field injection, content analysis,
 * sitemap generation, robots.txt, and meta tag API.
 *
 * @example
 * ```typescript
 * import { seoPlugin } from '@momentumcms/plugins/seo';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     seoPlugin({
 *       collections: ['posts', 'pages'],
 *       siteUrl: 'https://example.com',
 *     }),
 *   ],
 * });
 * ```
 */

import type {
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	PluginAdminRouteDescriptor,
	MomentumAPI,
} from '@momentumcms/plugins/core';
import type { SeoPluginConfig, SeoAnalysisConfig } from './seo-config.types';
import { injectSeoFields } from './seo-field-injector';
import { hasSeoField } from './seo-utils';
import { SeoAnalysis } from './analysis/seo-analysis-collection';
import { injectSeoAnalysisHooks } from './analysis/seo-analysis-hooks';
import { createSitemapRouter } from './sitemap/sitemap-handler';
import { SeoSitemapSettings } from './sitemap/sitemap-settings-collection';
import { createSitemapSettingsRouter } from './sitemap/sitemap-settings-handler';
import { createRobotsRouter } from './robots/robots-handler';
import { createMetaRouter } from './meta/meta-handler';
import { createDashboardRouter } from './dashboard/seo-analysis-handler';
import { SeoSettings } from './settings/seo-settings-collection';
import { createSeoSettingsRouter } from './settings/seo-settings-handler';

/**
 * Resolve the admin dashboard config into admin routes.
 *
 * NOTE: Uses a variable-based import path to prevent esbuild from
 * following the dashboard import at CJS build time.
 */
function resolveAdminRoutes(
	dashboardConfig: SeoPluginConfig['adminDashboard'],
): PluginAdminRouteDescriptor[] {
	if (dashboardConfig === false) return [];

	const dashboardModule = './dashboard/seo-dashboard.page';
	const defaultLoadComponent = (): Promise<unknown> =>
		import(dashboardModule).then((m: Record<string, unknown>) => m['SeoDashboardPage']);

	const defaultRoute: PluginAdminRouteDescriptor = {
		path: 'seo',
		label: 'SEO',
		icon: 'heroMagnifyingGlass',
		loadComponent: defaultLoadComponent,
		group: 'SEO',
	};

	const sitemapModule = './sitemap/sitemap-settings.page';
	const sitemapRoute: PluginAdminRouteDescriptor = {
		path: 'seo/sitemap',
		label: 'Sitemap',
		icon: 'heroMap',
		loadComponent: (): Promise<unknown> =>
			import(sitemapModule).then((m: Record<string, unknown>) => m['SitemapSettingsPage']),
		group: 'SEO',
	};

	const robotsModule = './robots/robots-settings.page';
	const robotsRoute: PluginAdminRouteDescriptor = {
		path: 'seo/robots',
		label: 'Robots',
		icon: 'heroDocumentText',
		loadComponent: (): Promise<unknown> =>
			import(robotsModule).then((m: Record<string, unknown>) => m['RobotsSettingsPage']),
		group: 'SEO',
	};

	if (dashboardConfig === undefined || dashboardConfig === true) {
		return [defaultRoute, sitemapRoute, robotsRoute];
	}

	return [
		{
			...defaultRoute,
			loadComponent: dashboardConfig.loadComponent ?? defaultLoadComponent,
			group: dashboardConfig.group ?? defaultRoute.group,
		},
		sitemapRoute,
		robotsRoute,
	];
}

/**
 * Normalize analysis config into a SeoAnalysisConfig object or null.
 */
function resolveAnalysisConfig(analysis: SeoPluginConfig['analysis']): SeoAnalysisConfig | null {
	if (analysis === false) return null;
	if (analysis === undefined || analysis === true) return {};
	return analysis;
}

/**
 * Creates an SEO plugin.
 *
 * @param config - SEO plugin configuration
 * @returns Plugin instance
 */
export function seoPlugin(config: SeoPluginConfig): MomentumPlugin {
	const adminRoutes = resolveAdminRoutes(config.adminDashboard);
	const analysisConfig = resolveAnalysisConfig(config.analysis);
	const siteUrl = config.siteUrl ?? '';

	let momentumApi: MomentumAPI | null = null;

	// Track which collection slugs have seo fields (for sitemap/meta)
	const seoCollectionSlugs = new Set<string>();

	return {
		name: 'seo',
		adminRoutes,

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins/seo/admin-routes',
				exportName: 'seoAdminRoutes',
			},
			modifyCollections: {
				path: '@momentumcms/plugins/seo/fields',
				exportName: 'injectSeoFields',
			},
		},

		modifyCollections(collections) {
			if (config.enabled === false) return;
			injectSeoFields(collections, {
				collections: config.collections,
				excludeCollections: config.excludeCollections,
			});
		},

		async onInit({ collections, logger, registerMiddleware }: PluginContext) {
			if (config.enabled === false) {
				logger.info('SEO plugin disabled');
				return;
			}

			// Inject SEO fields into targeted collections
			injectSeoFields(collections, {
				collections: config.collections,
				excludeCollections: config.excludeCollections,
			});
			logger.info('SEO fields injected');

			// Track SEO-enabled collections (Set prevents duplicates on re-init)
			for (const c of collections) {
				if (hasSeoField(c)) {
					seoCollectionSlugs.add(c.slug);
				}
			}

			// Analysis setup (guard prevents duplicate collection on re-init)
			if (analysisConfig && !collections.some((c) => c.slug === 'seo-analysis')) {
				collections.push(SeoAnalysis);
				injectSeoAnalysisHooks(collections, analysisConfig, () => momentumApi);
				logger.info('SEO analysis hooks injected');
			}

			// Register each router separately (matches analytics plugin pattern —
			// each handler factory creates its own Router via static import)
			if (config.sitemap !== false) {
				// Sitemap settings managed collection (guard prevents duplicate on re-init)
				if (!collections.some((c) => c.slug === 'seo-sitemap-settings')) {
					collections.push(SeoSitemapSettings);
				}

				const sitemapConfig = typeof config.sitemap === 'object' ? config.sitemap : {};
				const { router: sitemapRouter, clearCache } = createSitemapRouter({
					getApi: () => momentumApi,
					siteUrl,
					config: sitemapConfig,
					seoCollections: [...seoCollectionSlugs],
				});
				// Root-level: crawlers expect /sitemap.xml at the domain root
				registerMiddleware({
					path: '/',
					handler: sitemapRouter,
					position: 'root',
				});
				logger.info('Sitemap endpoint registered at /sitemap.xml');

				// Sitemap settings CRUD endpoint (invalidates sitemap cache on changes)
				const settingsRouter = createSitemapSettingsRouter({
					getApi: () => momentumApi,
					seoCollections: [...seoCollectionSlugs],
					onSettingsChanged: clearCache,
				});
				registerMiddleware({
					path: '/seo',
					handler: settingsRouter,
					position: 'before-api',
				});
				logger.info('Sitemap settings endpoint registered');
			}

			if (config.robots !== false) {
				const robotsConfig = typeof config.robots === 'object' ? config.robots : {};

				// SEO settings managed collection (guard prevents duplicate on re-init)
				if (!collections.some((c) => c.slug === 'seo-settings')) {
					collections.push(SeoSettings);
				}

				const { router: robotsRouter, clearCache: clearRobotsCache } = createRobotsRouter({
					siteUrl,
					config: robotsConfig,
					getApi: () => momentumApi,
				});
				// Root-level: crawlers expect /robots.txt at the domain root
				registerMiddleware({
					path: '/',
					handler: robotsRouter,
					position: 'root',
				});
				logger.info('Robots.txt endpoint registered at /robots.txt');

				// SEO settings CRUD endpoint (invalidates robots cache on changes)
				const seoSettingsRouter = createSeoSettingsRouter({
					getApi: () => momentumApi,
					defaultRobotsConfig: robotsConfig,
					onSettingsChanged: clearRobotsCache,
				});
				registerMiddleware({
					path: '/seo',
					handler: seoSettingsRouter,
					position: 'before-api',
				});
				logger.info('SEO settings endpoint registered');
			}

			if (config.metaApi !== false) {
				const metaRouter = createMetaRouter({
					getApi: () => momentumApi,
					siteUrl,
					seoCollections: [...seoCollectionSlugs],
				});
				registerMiddleware({
					path: '/seo',
					handler: metaRouter,
					position: 'before-api',
				});
				logger.info('Meta tag API endpoint registered');
			}

			// Dashboard read endpoint (seo-analysis is managed — no auto-generated routes)
			const dashboardRouter = createDashboardRouter({ getApi: () => momentumApi });
			registerMiddleware({
				path: '/seo',
				handler: dashboardRouter,
				position: 'before-api',
			});
			logger.info('SEO dashboard API endpoint registered');

			if (adminRoutes.length > 0) {
				logger.info('SEO admin dashboard route declared');
			}

			logger.info('SEO plugin initialized');
		},

		async onReady({ logger, api }: PluginReadyContext) {
			if (config.enabled === false) return;
			momentumApi = api;
			logger.info('SEO plugin ready');
		},

		async onShutdown({ logger }) {
			logger.info('SEO plugin shut down');
		},
	};
}

/**
 * Cache Plugin
 *
 * A Momentum CMS plugin that adds API response caching with
 * ETag support, automatic invalidation, and CDN headers.
 *
 * @example
 * ```typescript
 * import { cachePlugin } from '@momentumcms/plugins/cache';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     cachePlugin({
 *       defaultTtl: 120,
 *       defaultScope: 'public',
 *       collections: {
 *         posts: { ttl: 300, scope: 'public' },
 *         users: { enabled: false },
 *       },
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
} from '@momentumcms/plugins/core';
import type { CachePluginConfig } from './cache-plugin-config.types';
import type { CacheAdapter } from './cache-adapter.types';
import { LRUCacheAdapter } from './adapters/lru-adapter';
import { buildDependencyGraph, injectCacheInvalidationHooks } from './invalidation';
import { createCacheMiddleware, createCacheManagementRouter } from './cache-middleware';

/**
 * Cache plugin instance with access to the adapter.
 */
export interface CachePluginInstance extends MomentumPlugin {
	/** The cache adapter — use for manual cache operations */
	adapter: CacheAdapter;
	/** The cache configuration */
	cacheConfig: CachePluginConfig;
}

/**
 * Resolve the admin dashboard route.
 */
function resolveAdminRoutes(
	dashboardConfig: CachePluginConfig['adminDashboard'],
): PluginAdminRouteDescriptor[] {
	if (dashboardConfig === false) return [];

	const dashboardModule = './admin/cache-dashboard.page';
	const defaultLoadComponent = (): Promise<unknown> =>
		import(dashboardModule).then((m: Record<string, unknown>) => m['CacheDashboardPage']);

	return [
		{
			path: 'cache',
			label: 'Cache',
			// Server-stack reads as caching layer; heroBolt was generic and overloaded.
			icon: 'heroServerStack',
			loadComponent: defaultLoadComponent,
			group: 'System',
		},
	];
}

/**
 * Creates a cache plugin.
 *
 * @param config - Cache configuration
 * @returns Plugin instance
 */
export function cachePlugin(config: CachePluginConfig = {}): CachePluginInstance {
	const adapter: CacheAdapter =
		config.adapter ?? new LRUCacheAdapter({ maxSize: config.maxSize ?? 1000 });
	const adminRoutes = resolveAdminRoutes(config.adminDashboard);

	return {
		name: 'cache',
		adapter,
		cacheConfig: config,
		adminRoutes,

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-cache/admin-routes',
				exportName: 'cacheAdminRoutes',
			},
		},

		async onInit({ collections, logger, registerMiddleware, config: fullConfig }: PluginContext) {
			// Initialize adapter
			if (adapter.initialize) {
				logger.info('Initializing cache adapter...');
				await adapter.initialize();
			}

			// Auto-exclude auth collections
			const excludeList = [...(config.excludeCollections ?? [])];
			for (const coll of collections) {
				if (coll.auth && !excludeList.includes(coll.slug)) {
					excludeList.push(coll.slug);
				}
			}
			const excludeSet = new Set(excludeList);

			// Build dependency graph for relationship invalidation
			const dependencyGraph = buildDependencyGraph(collections);

			// Inject invalidation hooks
			const { invalidateGlobal } = injectCacheInvalidationHooks(
				collections,
				adapter,
				dependencyGraph,
				excludeSet,
				logger,
				config.logHitMiss ?? false,
				(fullConfig.globals ?? []).map((g) => ({ slug: g.slug })),
			);

			// Collect valid collection slugs and global slugs
			const collectionSlugs = new Set(
				collections.filter((c) => !excludeSet.has(c.slug)).map((c) => c.slug),
			);
			const globalSlugs = new Set((fullConfig.globals ?? []).map((g) => g.slug));

			// Register cache middleware
			const cacheRouter = createCacheMiddleware(
				adapter,
				config,
				collectionSlugs,
				globalSlugs,
				excludeSet,
				logger,
				invalidateGlobal,
			);
			registerMiddleware({
				path: '/',
				handler: cacheRouter,
				position: 'before-api',
			});

			// Register cache management endpoints
			const mgmtRouter = createCacheManagementRouter(adapter);
			registerMiddleware({
				path: '/cache',
				handler: mgmtRouter,
				position: 'before-api',
			});

			if (adminRoutes.length > 0) {
				logger.info('Cache admin dashboard route declared');
			}

			logger.info(
				`Cache plugin initialized — ${collectionSlugs.size} collections, ` +
					`${globalSlugs.size} globals, TTL=${config.defaultTtl ?? 60}s`,
			);
		},

		async onReady({ logger }: PluginReadyContext) {
			logger.info('Cache ready');
		},

		async onShutdown({ logger }) {
			logger.info('Shutting down cache...');
			if (adapter.shutdown) {
				await adapter.shutdown();
			}
			logger.info('Cache shut down');
		},
	};
}

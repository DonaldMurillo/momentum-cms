/**
 * Analytics Plugin
 *
 * A Momentum CMS plugin that wires all analytics collectors together.
 * Tracks collection CRUD, API requests, page views, and accepts client-side events.
 *
 * @example
 * ```typescript
 * import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentumcms/plugins/analytics';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     analyticsPlugin({
 *       adapter: new MemoryAnalyticsAdapter(),
 *       // Dashboard is included by default. Set false to disable.
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
import type { AnalyticsConfig } from './analytics-config.types';
import { EventStore } from './event-store';
import { injectCollectionCollector } from './collectors/collection-collector';
import { injectBlockAnalyticsFields } from './collectors/block-field-injector';
import { createIngestRouter } from './ingest-handler';
import { createApiCollectorMiddleware } from './collectors/api-collector';
import { createPageViewCollectorMiddleware } from './collectors/page-view-collector';
import { createAnalyticsQueryRouter } from './analytics-query-handler';
import { createContentPerformanceRouter } from './content-performance/content-performance-handler';
import { createTrackingRulesRouter } from './tracking-rules/tracking-rules-endpoint';
import { TrackingRules } from './tracking-rules/tracking-rules-collection';

/**
 * Analytics plugin with access to the event store.
 */
export interface AnalyticsPluginInstance extends MomentumPlugin {
	/** The event store — use for manual event emission */
	eventStore: EventStore;
	/** The analytics configuration */
	analyticsConfig: AnalyticsConfig;
}

/**
 * Resolve the admin dashboard config into admin routes.
 *
 * NOTE: Does NOT import `analytics-admin-routes.ts` because that file contains
 * a static `import('./dashboard/...')` that esbuild follows during the CJS build.
 * Instead, constructs routes inline using a variable-based import path.
 * For browser builds, use `@momentumcms/plugins-analytics/admin-routes` directly.
 */
function resolveAdminRoutes(
	dashboardConfig: AnalyticsConfig['adminDashboard'],
): PluginAdminRouteDescriptor[] {
	if (dashboardConfig === false) return [];

	// Variable-based path prevents esbuild from following the import at build time.
	const dashboardModule = './dashboard/analytics-dashboard.page';
	const defaultLoadComponent = (): Promise<unknown> =>
		import(dashboardModule).then((m: Record<string, unknown>) => m['AnalyticsDashboardPage']);

	const defaultRoute: PluginAdminRouteDescriptor = {
		path: 'analytics',
		label: 'Analytics',
		icon: 'heroChartBarSquare',
		loadComponent: defaultLoadComponent,
		group: 'Analytics',
	};

	if (dashboardConfig === undefined || dashboardConfig === true) {
		return [defaultRoute];
	}

	return [
		{
			...defaultRoute,
			loadComponent: dashboardConfig.loadComponent ?? defaultLoadComponent,
			group: dashboardConfig.group ?? defaultRoute.group,
		},
	];
}

/**
 * Creates an analytics plugin.
 *
 * @param config - Analytics configuration
 * @returns Plugin instance
 */
export function analyticsPlugin(config: AnalyticsConfig): AnalyticsPluginInstance {
	const eventStore = new EventStore({
		adapter: config.adapter,
		flushInterval: config.flushInterval,
		flushBatchSize: config.flushBatchSize,
	});

	const adminRoutes = resolveAdminRoutes(config.adminDashboard);

	let momentumApi: MomentumAPI | null = null;

	// Content performance admin route
	if (config.contentPerformance !== false && config.adminDashboard !== false) {
		const contentPerfModule = './dashboard/content-performance.page';
		adminRoutes.push({
			path: 'analytics/content',
			label: 'Content Perf.',
			icon: 'heroDocumentText',
			loadComponent: (): Promise<unknown> =>
				import(contentPerfModule).then((m: Record<string, unknown>) => m['ContentPerformancePage']),
			group: 'Analytics',
		});
	}

	// Tracking rules admin route
	if (config.trackingRules !== false && config.adminDashboard !== false) {
		const trackingRulesModule = './dashboard/tracking-rules.page';
		adminRoutes.push({
			path: 'analytics/tracking-rules',
			label: 'Tracking Rules',
			icon: 'heroCursorArrowRays',
			loadComponent: (): Promise<unknown> =>
				import(trackingRulesModule).then((m: Record<string, unknown>) => m['TrackingRulesPage']),
			group: 'Analytics',
		});
	}

	return {
		name: 'analytics',
		eventStore,
		analyticsConfig: config,
		adminRoutes,

		// Browser-safe import paths for the admin config generator
		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-analytics/admin-routes',
				exportName: 'analyticsAdminRoutes',
			},
			modifyCollections: {
				path: '@momentumcms/plugins-analytics/block-fields',
				exportName: 'injectBlockAnalyticsFields',
			},
		},

		modifyCollections(collections) {
			if (config.enabled !== false && config.blockTracking !== false) {
				injectBlockAnalyticsFields(collections);
			}
		},

		async onInit({ collections, logger, registerMiddleware }: PluginContext) {
			if (config.enabled === false) {
				logger.info('Analytics disabled');
				return;
			}

			// Initialize adapter if it supports it
			if (config.adapter.initialize) {
				logger.info('Initializing analytics adapter...');
				await config.adapter.initialize();
			}

			// Inject block analytics fields (admin toggles per block instance)
			if (config.blockTracking !== false) {
				injectBlockAnalyticsFields(collections);
				logger.info('Block analytics fields injected');
			}

			// Inject collection CRUD tracking hooks
			if (config.trackCollections !== false) {
				injectCollectionCollector(collections, (event) => eventStore.add(event), {
					excludeCollections: config.excludeCollections,
				});
				logger.info(`Collection tracking enabled for ${collections.length} collections`);
			}

			// Register ingest endpoint (clients POST events here)
			const ingestRouter = createIngestRouter({
				eventStore,
				rateLimit: config.ingestRateLimit,
			});
			registerMiddleware({
				path: config.ingestPath ?? '/analytics/collect',
				handler: ingestRouter,
				position: 'before-api',
			});

			// Register analytics query endpoints
			const queryRouter = createAnalyticsQueryRouter(eventStore, config.adapter);
			registerMiddleware({
				path: '/analytics',
				handler: queryRouter,
				position: 'before-api',
			});

			// Register API collector middleware (wraps API requests for timing)
			if (config.trackApi !== false) {
				const apiCollector = createApiCollectorMiddleware((event) => eventStore.add(event));
				registerMiddleware({
					path: '/',
					handler: apiCollector,
					position: 'before-api',
				});
			}

			// Register page view collector middleware (SSR page renders)
			if (config.trackPageViews !== false) {
				const pageViewOptions =
					typeof config.trackPageViews === 'object' ? config.trackPageViews : {};
				const pageViewCollector = createPageViewCollectorMiddleware(
					(event) => eventStore.add(event),
					pageViewOptions,
				);
				registerMiddleware({
					path: '/',
					handler: pageViewCollector,
					position: 'root',
				});
				logger.info('Page view tracking enabled');
			}

			// Register content performance endpoint
			if (config.contentPerformance !== false) {
				const contentPerfRouter = createContentPerformanceRouter(config.adapter);
				registerMiddleware({
					path: '/analytics',
					handler: contentPerfRouter,
					position: 'before-api',
				});
				logger.info('Content performance endpoint registered');
			}

			// Register tracking rules collection and endpoint
			if (config.trackingRules !== false) {
				const cacheTtl =
					typeof config.trackingRules === 'object' ? config.trackingRules.cacheTtl : undefined;
				const { router: trackingRulesRouter, invalidateCache } = createTrackingRulesRouter(
					() => momentumApi,
					cacheTtl != null ? { cacheTtl } : undefined,
				);

				// Add cache invalidation hooks so CRUD operations clear stale rules
				const rulesWithHooks = {
					...TrackingRules,
					hooks: {
						...TrackingRules.hooks,
						afterChange: [
							...(TrackingRules.hooks?.afterChange ?? []),
							(): void => {
								invalidateCache();
							},
						],
						afterDelete: [
							...(TrackingRules.hooks?.afterDelete ?? []),
							(): void => {
								invalidateCache();
							},
						],
					},
				};
				collections.push(rulesWithHooks);

				registerMiddleware({
					path: '/analytics',
					handler: trackingRulesRouter,
					position: 'before-api',
				});
				logger.info('Tracking rules collection and endpoint registered');
			}

			if (adminRoutes.length > 0) {
				logger.info('Analytics admin dashboard route declared');
			}

			logger.info('Analytics plugin initialized');
		},

		async onReady({ logger, api }: PluginReadyContext) {
			if (config.enabled === false) return;

			// Store API reference for tracking rules endpoint
			momentumApi = api;

			// Start the periodic flush timer
			eventStore.start();
			logger.info('Analytics event flush timer started');
		},

		async onShutdown({ logger }) {
			logger.info('Shutting down analytics...');
			await eventStore.shutdown();

			if (config.adapter.shutdown) {
				await config.adapter.shutdown();
			}

			logger.info('Analytics shut down');
		},
	};
}

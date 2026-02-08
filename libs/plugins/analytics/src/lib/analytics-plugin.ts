/**
 * Analytics Plugin
 *
 * A Momentum CMS plugin that wires all analytics collectors together.
 * Tracks collection CRUD, API requests, and accepts client-side events.
 *
 * @example
 * ```typescript
 * import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentum-cms/plugins/analytics';
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
	PluginAdminRouteDescriptor,
} from '@momentum-cms/plugins/core';
import type { AnalyticsConfig } from './analytics-config.types';
import { EventStore } from './event-store';
import { injectCollectionCollector } from './collectors/collection-collector';
import { createIngestRouter } from './ingest-handler';
import { createApiCollectorMiddleware } from './collectors/api-collector';
import { createAnalyticsQueryRouter } from './analytics-query-handler';

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
 * For browser builds, use `@momentum-cms/plugins/analytics/admin-routes` directly.
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
		group: 'Tools',
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

	return {
		name: 'analytics',
		eventStore,
		analyticsConfig: config,
		adminRoutes,

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

			if (adminRoutes.length > 0) {
				logger.info('Analytics admin dashboard route declared');
			}

			logger.info('Analytics plugin initialized');
		},

		async onReady({ logger }) {
			if (config.enabled === false) return;

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

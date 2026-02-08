/**
 * Analytics Plugin
 *
 * A Momentum CMS plugin that wires all analytics collectors together.
 * Tracks collection CRUD, API requests, and accepts client-side events.
 *
 * @example
 * ```typescript
 * import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentum-cms/analytics';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     analyticsPlugin({
 *       adapter: new MemoryAnalyticsAdapter(),
 *     }),
 *   ],
 * });
 * ```
 */

import type { MomentumPlugin, PluginContext } from '@momentum-cms/plugins';
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

	return {
		name: 'analytics',
		eventStore,
		analyticsConfig: config,

		async onInit({ collections, logger, registerMiddleware, registerAdminRoute }: PluginContext) {
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

			// Register admin dashboard route if configured
			if (config.adminDashboard) {
				registerAdminRoute({
					path: 'analytics',
					label: 'Analytics',
					icon: 'heroChartBarSquare',
					loadComponent: config.adminDashboard.loadComponent,
					group: config.adminDashboard.group ?? 'Tools',
				});
				logger.info('Analytics admin dashboard route registered');
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

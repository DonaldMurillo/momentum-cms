/**
 * Analytics Express Middleware
 *
 * Convenience function to create all Express middleware from an analytics plugin instance.
 * Returns the ingest router (for client-side events) and API collector middleware.
 *
 * @example
 * ```typescript
 * import { analyticsPlugin, createAnalyticsMiddleware, MemoryAnalyticsAdapter } from '@momentum-cms/plugins/analytics';
 *
 * const analytics = analyticsPlugin({ adapter: new MemoryAnalyticsAdapter() });
 *
 * // In Express setup:
 * const { ingestRouter, apiCollector } = createAnalyticsMiddleware(analytics);
 * app.use('/api/analytics/collect', ingestRouter);
 * app.use('/api', apiCollector);
 * ```
 */

import type { Router, Request, Response, NextFunction } from 'express';
import type { AnalyticsPluginInstance } from './analytics-plugin';
import { createIngestRouter } from './ingest-handler';
import { createApiCollectorMiddleware } from './collectors/api-collector';

/**
 * Result of createAnalyticsMiddleware.
 */
export interface AnalyticsMiddleware {
	/** Express router for the ingest endpoint (mount at your ingest path) */
	ingestRouter: Router;
	/** Express middleware that tracks API request timing/status (mount before API routes) */
	apiCollector: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Creates all Express middleware from an analytics plugin instance.
 *
 * @deprecated The analytics plugin now auto-registers its middleware via the plugin system.
 * Simply add `analyticsPlugin(config)` to your `plugins` array in momentum.config.ts
 * and the framework will mount the ingest router and API collector automatically.
 *
 * @param plugin - The analytics plugin instance (returned by `analyticsPlugin()`)
 * @returns Object with ingest router and API collector middleware
 */
export function createAnalyticsMiddleware(plugin: AnalyticsPluginInstance): AnalyticsMiddleware {
	const { eventStore, analyticsConfig } = plugin;

	const ingestRouter = createIngestRouter({
		eventStore,
		rateLimit: analyticsConfig.ingestRateLimit,
	});

	const apiCollector = createApiCollectorMiddleware((event) => eventStore.add(event));

	return { ingestRouter, apiCollector };
}

// Analytics event types
export type {
	AnalyticsEvent,
	AnalyticsCategory,
	AnalyticsContext,
	AnalyticsQueryOptions,
	AnalyticsQueryResult,
} from './lib/analytics-event.types';

// Analytics config types
export type { AnalyticsAdapter, AnalyticsConfig } from './lib/analytics-config.types';

// Event store
export { EventStore, type EventStoreOptions } from './lib/event-store';

// Collection collector
export {
	injectCollectionCollector,
	type AnalyticsEmitter,
	type CollectionCollectorOptions,
} from './lib/collectors/collection-collector';

// API collector
export { createApiCollectorMiddleware } from './lib/collectors/api-collector';

// Ingest handler
export { createIngestRouter, type IngestHandlerOptions } from './lib/ingest-handler';

// Adapters
export { MemoryAnalyticsAdapter } from './lib/adapters/memory-adapter';
export {
	postgresAnalyticsAdapter,
	type PostgresAnalyticsAdapterOptions,
} from './lib/adapters/postgres-adapter';

// User-agent parser
export { parseUserAgent, type ParsedUserAgent } from './lib/utils/parse-user-agent';

// Client-side tracker
export {
	createTracker,
	type TrackerConfig,
	type MomentumTracker,
	type ClientEvent,
} from './lib/client/tracker';

// Analytics plugin
export { analyticsPlugin, type AnalyticsPluginInstance } from './lib/analytics-plugin';

// Analytics query handler
export { createAnalyticsQueryRouter, type AnalyticsSummary } from './lib/analytics-query-handler';

// Convenience middleware factory
export { createAnalyticsMiddleware, type AnalyticsMiddleware } from './lib/analytics-middleware';

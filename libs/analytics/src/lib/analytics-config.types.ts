/**
 * Analytics Configuration Types
 */

import type {
	AnalyticsEvent,
	AnalyticsQueryOptions,
	AnalyticsQueryResult,
} from './analytics-event.types';

/**
 * Analytics storage adapter interface.
 * Implement this to store analytics events in your preferred backend.
 */
export interface AnalyticsAdapter {
	/** Store a batch of events */
	store(events: AnalyticsEvent[]): Promise<void>;
	/** Query events (for admin dashboard) */
	query?(options: AnalyticsQueryOptions): Promise<AnalyticsQueryResult>;
	/** Initialize adapter (create tables, etc.) */
	initialize?(): Promise<void>;
	/** Flush pending events and close connections */
	shutdown?(): Promise<void>;
}

/**
 * Analytics configuration.
 */
export interface AnalyticsConfig {
	/** Enable/disable analytics. @default true */
	enabled?: boolean;
	/** Analytics storage adapter */
	adapter: AnalyticsAdapter;
	/** Server-side collection tracking. @default true */
	trackCollections?: boolean;
	/** API request tracking. @default true */
	trackApi?: boolean;
	/** Admin action tracking. @default true */
	trackAdmin?: boolean;
	/** Client-side ingest endpoint path. @default '/api/analytics/collect' */
	ingestPath?: string;
	/** Rate limit for ingest endpoint (requests per minute per IP). @default 100 */
	ingestRateLimit?: number;
	/** Batch flush interval in ms. @default 5000 */
	flushInterval?: number;
	/** Batch size before forced flush. @default 100 */
	flushBatchSize?: number;
	/** Collections to exclude from tracking */
	excludeCollections?: string[];
	/** Admin dashboard configuration. When set, registers an admin UI route. */
	adminDashboard?: {
		/** Lazy component loader (e.g., () => import('@momentum-cms/admin').then(m => m.AnalyticsDashboardPage)) */
		loadComponent: unknown;
		/** Sidebar section name. @default 'Tools' */
		group?: string;
	};
}

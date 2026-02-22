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
 * Options for server-side page view tracking.
 */
export interface PageViewTrackingOptions {
	/** Additional path prefixes to exclude from tracking. */
	excludePaths?: string[];
	/** File extensions to ignore (overrides defaults when provided). */
	excludeExtensions?: string[];
	/** Only track responses with 2xx status codes. @default true */
	onlySuccessful?: boolean;
	/** Whether to track bot traffic (Googlebot, Bingbot, etc.). @default false */
	trackBots?: boolean;
	/**
	 * Map collection slugs to URL patterns for content attribution.
	 * When a page view URL matches a pattern, the event is enriched with
	 * collection and slug metadata, enabling per-document analytics.
	 * Patterns use Express-style `:param` syntax.
	 * @example { articles: '/articles/:slug', pages: '/:slug' }
	 */
	contentRoutes?: Record<string, string>;
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
	/**
	 * Server-side page view tracking (SSR page renders).
	 * - `true` (default): enable with default settings
	 * - `false`: disable
	 * - object: override page view tracking options
	 * @default true
	 */
	trackPageViews?: boolean | PageViewTrackingOptions;
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
	/**
	 * Inject analytics toggle fields into block definitions.
	 * When enabled, admins can toggle impression/click tracking per block instance.
	 * @default true
	 */
	blockTracking?: boolean;
	/**
	 * Content performance endpoint and admin page.
	 * @default true
	 */
	contentPerformance?: boolean;
	/**
	 * Element tracking rules (admin-managed CSS selector listeners).
	 * - `true` (default): enable with default settings
	 * - `false`: disable
	 * - object: override cache TTL
	 */
	trackingRules?: boolean | { cacheTtl?: number };
	/**
	 * Admin dashboard configuration.
	 * - `true` (default): use built-in dashboard
	 * - `false`: disable dashboard
	 * - object: override loadComponent and/or group
	 */
	adminDashboard?:
		| boolean
		| {
				/** Override lazy component loader */
				loadComponent?: unknown;
				/** Sidebar section name. @default 'Tools' */
				group?: string;
		  };
}

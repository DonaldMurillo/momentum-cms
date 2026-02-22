import type { EnvironmentProviders } from '@angular/core';

/** Configuration for the client-side page view tracker. */
export interface PageViewTrackingConfig {
	/** Map of collection slug -> URL pattern (e.g. `{ articles: '/articles/:slug' }`) */
	contentRoutes?: Record<string, string>;
	/** Ingest endpoint URL. @default '/api/analytics/collect' */
	endpoint?: string;
	/** Additional path prefixes to exclude from tracking. */
	excludePrefixes?: readonly string[];
}

/**
 * Provide client-side page view tracking for an Angular application.
 *
 * Listens to Angular Router NavigationEnd events and sends page_view analytics
 * events to the ingest endpoint for SPA navigations.
 */
export declare function providePageViewTracking(
	config: PageViewTrackingConfig,
): EnvironmentProviders;

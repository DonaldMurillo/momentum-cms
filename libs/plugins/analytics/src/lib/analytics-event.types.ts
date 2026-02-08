/**
 * Analytics Event Types
 */

/**
 * Analytics event categories.
 */
export type AnalyticsCategory = 'admin' | 'api' | 'content' | 'page' | 'action' | 'custom';

/**
 * A single analytics event.
 */
export interface AnalyticsEvent {
	/** Unique event ID */
	id: string;
	/** Event category */
	category: AnalyticsCategory;
	/** Event name (e.g., 'page_view', 'content_created', 'button_click') */
	name: string;
	/** ISO timestamp */
	timestamp: string;
	/** Session ID (for client events) */
	sessionId?: string;
	/** User/visitor identifier */
	userId?: string;
	/** Anonymous visitor ID (for non-authenticated frontend users) */
	visitorId?: string;
	/** Event-specific properties */
	properties: Record<string, unknown>;
	/** Context metadata */
	context: AnalyticsContext;
}

/**
 * Context metadata for analytics events.
 */
export interface AnalyticsContext {
	/** Source: 'server' or 'client' */
	source: 'server' | 'client';
	/** Page URL */
	url?: string;
	/** Referrer URL */
	referrer?: string;
	/** Raw user agent string */
	userAgent?: string;
	/** Client IP address */
	ip?: string;
	/** Device type (mobile, tablet, desktop) */
	device?: string;
	/** Browser name (Chrome, Firefox, Safari, etc.) */
	browser?: string;
	/** Operating system (Windows, macOS, Linux, iOS, Android) */
	os?: string;
	/** For server events: collection slug */
	collection?: string;
	/** For server events: operation type */
	operation?: string;
	/** For API events: response time in ms */
	duration?: number;
	/** For API events: HTTP status code */
	statusCode?: number;
}

/**
 * Query options for retrieving analytics events.
 */
export interface AnalyticsQueryOptions {
	/** Filter by category */
	category?: AnalyticsCategory;
	/** Filter by event name */
	name?: string;
	/** Filter by collection */
	collection?: string;
	/** Full-text search across event name, URL, collection */
	search?: string;
	/** Start date (ISO string) */
	from?: string;
	/** End date (ISO string) */
	to?: string;
	/** Maximum number of results */
	limit?: number;
	/** Page number (1-based) */
	page?: number;
}

/**
 * Result of an analytics query.
 */
export interface AnalyticsQueryResult {
	events: AnalyticsEvent[];
	total: number;
	page: number;
	limit: number;
}

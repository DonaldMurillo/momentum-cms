/**
 * Content Performance Types
 *
 * Types for the per-document analytics feature.
 */

/**
 * Performance data for a specific document.
 */
export interface ContentPerformanceData {
	/** Total page views for this document */
	pageViews: number;
	/** Unique visitor count */
	uniqueVisitors: number;
	/** Top referrer URLs */
	topReferrers: Array<{ referrer: string; count: number }>;
	/** Block-level engagement (if block tracking is enabled) */
	blockEngagement?: Array<{ blockType: string; impressions: number; hovers: number }>;
}

/**
 * Query parameters for the content performance endpoint.
 */
export interface ContentPerformanceQuery {
	/** Collection slug */
	collection: string;
	/** Document ID */
	documentId: string;
	/** Start date (ISO string) */
	from?: string;
	/** End date (ISO string) */
	to?: string;
}

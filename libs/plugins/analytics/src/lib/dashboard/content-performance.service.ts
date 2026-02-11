/**
 * Content Performance Service
 *
 * Data layer for the Content Performance admin page (deep-dive traffic analysis).
 *
 * Two data sources:
 * - Top pages: client-side aggregation of page_view events (URL ranking, visitors, referrers)
 * - Per-document performance: server-side endpoint (/api/analytics/content-performance)
 *   returning pageViews, uniqueVisitors, topReferrers, and block engagement per document
 *
 * Provides signals for reactive data binding in the admin UI.
 */

import { Injectable, signal } from '@angular/core';
import type { ContentPerformanceData } from '../content-performance/content-performance.types';

/** Aggregated page entry from page_view events. */
export interface TopPageEntry {
	url: string;
	pageViews: number;
	uniqueVisitors: number;
	referrers: Array<{ referrer: string; count: number }>;
}

/** Type guard for analytics query result shape. */
function isQueryResult(val: unknown): val is {
	events: Array<{
		visitorId?: string;
		sessionId?: string;
		context: { url?: string; referrer?: string };
	}>;
} {
	if (val == null || typeof val !== 'object') return false;
	if (!('events' in val)) return false;
	return Array.isArray(val.events);
}

/**
 * Extract pathname from a URL string.
 * Returns the original string if parsing fails.
 */
function extractPathname(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

@Injectable({ providedIn: 'root' })
export class ContentPerformanceService {
	/** Loading state for top pages */
	readonly loading = signal(false);

	/** Error state */
	readonly error = signal<string | null>(null);

	/** Aggregated top pages data */
	readonly topPages = signal<TopPageEntry[]>([]);

	/** Loading state for per-document performance */
	readonly detailLoading = signal(false);

	/** Per-document performance data */
	readonly detail = signal<ContentPerformanceData | null>(null);

	/**
	 * Fetch top pages by aggregating page_view events.
	 */
	async fetchTopPages(params: { from?: string; to?: string } = {}): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const searchParams = new URLSearchParams();
			searchParams.set('name', 'page_view');
			searchParams.set('limit', '1000');
			if (params.from) searchParams.set('from', params.from);
			if (params.to) searchParams.set('to', params.to);

			const response = await fetch(`/api/analytics/query?${searchParams.toString()}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const raw: unknown = await response.json();
			if (!isQueryResult(raw)) {
				this.topPages.set([]);
				return;
			}

			// Aggregate events by URL pathname
			const urlMap = new Map<
				string,
				{ views: number; visitors: Set<string>; referrers: Map<string, number> }
			>();

			for (const event of raw.events) {
				const rawUrl = event.context.url;
				if (!rawUrl || typeof rawUrl !== 'string') continue;

				const pathname = extractPathname(rawUrl);
				let entry = urlMap.get(pathname);
				if (!entry) {
					entry = { views: 0, visitors: new Set(), referrers: new Map() };
					urlMap.set(pathname, entry);
				}

				entry.views++;

				const visitorKey = event.visitorId ?? event.sessionId;
				if (visitorKey) entry.visitors.add(visitorKey);

				const ref = event.context.referrer;
				if (ref && typeof ref === 'string') {
					entry.referrers.set(ref, (entry.referrers.get(ref) ?? 0) + 1);
				}
			}

			const pages: TopPageEntry[] = [];
			for (const [url, entry] of urlMap) {
				const referrers: TopPageEntry['referrers'] = [];
				for (const [referrer, count] of entry.referrers) {
					referrers.push({ referrer, count });
				}
				referrers.sort((a, b) => b.count - a.count);

				pages.push({
					url,
					pageViews: entry.views,
					uniqueVisitors: entry.visitors.size,
					referrers,
				});
			}

			pages.sort((a, b) => b.pageViews - a.pageViews);
			this.topPages.set(pages);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Fetch per-document performance data.
	 */
	async fetchPerformance(params: {
		collection: string;
		documentId: string;
		from?: string;
		to?: string;
	}): Promise<void> {
		this.detailLoading.set(true);

		try {
			const searchParams = new URLSearchParams();
			searchParams.set('collection', params.collection);
			searchParams.set('documentId', params.documentId);
			if (params.from) searchParams.set('from', params.from);
			if (params.to) searchParams.set('to', params.to);

			const url = `/api/analytics/content-performance?${searchParams.toString()}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data: ContentPerformanceData = await response.json();
			this.detail.set(data);
		} catch {
			this.detail.set(null);
		} finally {
			this.detailLoading.set(false);
		}
	}
}

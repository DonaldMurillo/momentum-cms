/**
 * Analytics Service
 *
 * Injectable service for fetching analytics data from the server.
 * Provides signals for reactive data binding.
 */

import { Injectable, signal } from '@angular/core';

/**
 * Pre-aggregated analytics summary from the server.
 */
export interface AnalyticsSummaryData {
	totalEvents: number;
	byCategory: Record<string, number>;
	byCollection: Record<string, number>;
	contentOperations: {
		created: number;
		updated: number;
		deleted: number;
	};
	apiMetrics: {
		totalRequests: number;
		avgDuration: number;
	};
	activeSessions: number;
	activeVisitors: number;
}

/**
 * Analytics event from the server.
 */
export interface AnalyticsEventData {
	id: string;
	category: string;
	name: string;
	timestamp: string;
	sessionId?: string;
	userId?: string;
	visitorId?: string;
	properties: Record<string, unknown>;
	context: {
		source: 'server' | 'client';
		url?: string;
		collection?: string;
		operation?: string;
		duration?: number;
		statusCode?: number;
	};
}

/**
 * Query result for analytics events.
 */
export interface AnalyticsQueryResult {
	events: AnalyticsEventData[];
	total: number;
	page: number;
	limit: number;
}

/**
 * Options for querying analytics events.
 */
export interface AnalyticsQueryParams {
	category?: string;
	name?: string;
	collection?: string;
	from?: string;
	to?: string;
	limit?: number;
	page?: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
	/** Loading state */
	readonly loading = signal(false);

	/** Error state */
	readonly error = signal<string | null>(null);

	/** Summary data */
	readonly summary = signal<AnalyticsSummaryData | null>(null);

	/** Events query result */
	readonly events = signal<AnalyticsQueryResult | null>(null);

	/**
	 * Fetch the analytics summary.
	 */
	async fetchSummary(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const response = await fetch('/api/analytics/summary');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data: AnalyticsSummaryData = await response.json();
			this.summary.set(data);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Query analytics events.
	 */
	async queryEvents(params: AnalyticsQueryParams = {}): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const searchParams = new URLSearchParams();
			if (params.category) searchParams.set('category', params.category);
			if (params.name) searchParams.set('name', params.name);
			if (params.collection) searchParams.set('collection', params.collection);
			if (params.from) searchParams.set('from', params.from);
			if (params.to) searchParams.set('to', params.to);
			if (params.limit) searchParams.set('limit', String(params.limit));
			if (params.page) searchParams.set('page', String(params.page));

			const query = searchParams.toString();
			const url = query ? `/api/analytics/query?${query}` : '/api/analytics/query';

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data: AnalyticsQueryResult = await response.json();
			this.events.set(data);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.loading.set(false);
		}
	}
}

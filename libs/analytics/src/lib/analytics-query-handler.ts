/**
 * Analytics Query Handler
 *
 * Express router with endpoints for querying analytics data.
 * Provides paginated event queries and pre-aggregated summary metrics.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { EventStore } from './event-store';
import type { AnalyticsAdapter } from './analytics-config.types';
import type { AnalyticsCategory, AnalyticsQueryOptions } from './analytics-event.types';

/**
 * Pre-aggregated analytics summary.
 */
export interface AnalyticsSummary {
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

const VALID_CATEGORIES: readonly string[] = ['admin', 'api', 'content', 'page', 'action', 'custom'];

function isValidCategory(value: string): value is AnalyticsCategory {
	return VALID_CATEGORIES.includes(value);
}

/**
 * Creates an Express router with analytics query endpoints.
 */
export function createAnalyticsQueryRouter(
	eventStore: EventStore,
	adapter: AnalyticsAdapter,
): Router {
	const router = Router();

	/**
	 * GET /query — Paginated event query
	 * Query params: category, name, collection, from, to, limit, page
	 */
	router.get('/query', async (req: Request, res: Response) => {
		try {
			// Flush pending events before querying
			await eventStore.flush();

			if (!adapter.query) {
				res.status(501).json({ error: 'Adapter does not support queries' });
				return;
			}

			const options: AnalyticsQueryOptions = {};

			if (req.query['category'] && typeof req.query['category'] === 'string') {
				if (isValidCategory(req.query['category'])) {
					options.category = req.query['category'];
				}
			}
			if (req.query['name'] && typeof req.query['name'] === 'string') {
				options.name = req.query['name'];
			}
			if (req.query['collection'] && typeof req.query['collection'] === 'string') {
				options.collection = req.query['collection'];
			}
			if (req.query['from'] && typeof req.query['from'] === 'string') {
				options.from = req.query['from'];
			}
			if (req.query['to'] && typeof req.query['to'] === 'string') {
				options.to = req.query['to'];
			}
			if (req.query['limit'] && typeof req.query['limit'] === 'string') {
				const limit = parseInt(req.query['limit'], 10);
				if (!isNaN(limit) && limit > 0 && limit <= 200) {
					options.limit = limit;
				}
			}
			if (req.query['page'] && typeof req.query['page'] === 'string') {
				const page = parseInt(req.query['page'], 10);
				if (!isNaN(page) && page > 0) {
					options.page = page;
				}
			}

			const result = await adapter.query(options);
			res.json(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: `Query failed: ${message}` });
		}
	});

	/**
	 * GET /summary — Pre-aggregated metrics
	 */
	router.get('/summary', async (_req: Request, res: Response) => {
		try {
			// Flush pending events before computing summary
			await eventStore.flush();

			if (!adapter.query) {
				res.status(501).json({ error: 'Adapter does not support queries' });
				return;
			}

			// Query all events (no pagination limit for aggregation)
			const allEvents = await adapter.query({ limit: 10000 });
			const events = allEvents.events;

			const byCategory: Record<string, number> = {};
			const byCollection: Record<string, number> = {};
			const contentOps = { created: 0, updated: 0, deleted: 0 };
			let apiRequests = 0;
			let totalDuration = 0;
			const sessions = new Set<string>();
			const visitors = new Set<string>();

			for (const event of events) {
				// By category
				byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;

				// By collection
				if (event.context.collection) {
					byCollection[event.context.collection] =
						(byCollection[event.context.collection] ?? 0) + 1;
				}

				// Content operations
				if (event.category === 'content') {
					if (event.name === 'content_created') contentOps.created++;
					else if (event.name === 'content_updated') contentOps.updated++;
					else if (event.name === 'content_deleted') contentOps.deleted++;
				}

				// API metrics
				if (event.category === 'api') {
					apiRequests++;
					if (event.context.duration != null) {
						totalDuration += event.context.duration;
					}
				}

				// Sessions and visitors
				if (event.sessionId) sessions.add(event.sessionId);
				if (event.visitorId) visitors.add(event.visitorId);
			}

			const summary: AnalyticsSummary = {
				totalEvents: allEvents.total,
				byCategory,
				byCollection,
				contentOperations: contentOps,
				apiMetrics: {
					totalRequests: apiRequests,
					avgDuration: apiRequests > 0 ? Math.round(totalDuration / apiRequests) : 0,
				},
				activeSessions: sessions.size,
				activeVisitors: visitors.size,
			};

			res.json(summary);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: `Summary failed: ${message}` });
		}
	});

	return router;
}

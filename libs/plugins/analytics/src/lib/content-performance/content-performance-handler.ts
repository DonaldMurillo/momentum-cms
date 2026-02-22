/**
 * Content Performance Handler
 *
 * Express router that serves per-document analytics data.
 * Aggregates page_view events by URL pattern and document properties.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AnalyticsAdapter } from '../analytics-config.types';
import type { AnalyticsCategory, AnalyticsEvent } from '../analytics-event.types';
import type { ContentPerformanceData } from './content-performance.types';
import { requireAdmin } from '../analytics-auth';

/**
 * Check if an event's URL exactly matches the expected document path.
 * The adapter `search` param is a substring match (both memory + postgres),
 * so we post-filter to avoid prefix collisions (e.g. /posts/12 matching /posts/123).
 */
function matchesDocumentUrl(eventUrl: string | undefined, documentPath: string): boolean {
	if (!eventUrl) return false;
	let pathname: string;
	try {
		pathname = new URL(eventUrl).pathname;
	} catch {
		pathname = eventUrl;
	}
	return pathname === documentPath || pathname === `${documentPath}/`;
}

/**
 * Query events using content-attribution first, falling back to URL-based search.
 *
 * Runs two parallel queries for content-attributed events:
 * 1. Server events: adapter filters by context.collection (set by SSR page-view-collector)
 * 2. All events by name: post-filter by properties.collection + properties.slug
 *    (catches client SPA events where the ingest handler doesn't copy collection to context)
 *
 * Falls back to URL-based substring search for legacy events without any attribution.
 */
async function queryEventsByDocument(
	queryFn: NonNullable<AnalyticsAdapter['query']>,
	eventName: string,
	collection: string,
	documentId: string,
	documentPath: string,
	options: { category?: AnalyticsCategory; from?: string; to?: string },
): Promise<AnalyticsEvent[]> {
	const queryBase = {
		...(options.category ? { category: options.category } : {}),
		name: eventName,
		from: options.from,
		to: options.to,
		limit: 1000,
	};

	// Parallel queries: server events (context.collection) + all events (post-filter properties)
	const [serverResult, allResult] = await Promise.all([
		queryFn({ ...queryBase, collection }),
		queryFn(queryBase),
	]);

	// Merge and deduplicate by event ID
	const seen = new Set<string>();
	const results: AnalyticsEvent[] = [];
	for (const e of [...serverResult.events, ...allResult.events]) {
		if (seen.has(e.id)) continue;
		seen.add(e.id);
		const matchesCollection =
			e.context.collection === collection || e.properties['collection'] === collection;
		const matchesSlug =
			typeof e.properties['slug'] === 'string' && e.properties['slug'] === documentId;
		if (matchesCollection && matchesSlug) results.push(e);
	}
	if (results.length > 0) return results;

	// Fallback: URL-based search for legacy events without content attribution
	const urlResult = await queryFn({ ...queryBase, search: documentPath });
	return urlResult.events.filter((e) => matchesDocumentUrl(e.context.url, documentPath));
}

/**
 * Count events by blockType property.
 */
function countByBlockType(events: AnalyticsEvent[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const event of events) {
		const bt = String(event.properties['blockType'] ?? 'unknown');
		map.set(bt, (map.get(bt) ?? 0) + 1);
	}
	return map;
}

/**
 * Create an Express router for the content performance endpoint.
 *
 * @param adapter - Analytics storage adapter (must support query)
 * @returns Express Router
 */
export function createContentPerformanceRouter(adapter: AnalyticsAdapter): Router {
	const router = Router();

	router.get('/content-performance', requireAdmin, async (req: Request, res: Response) => {
		try {
			const query = req.query;
			const collection = typeof query['collection'] === 'string' ? query['collection'] : undefined;
			const documentId = typeof query['documentId'] === 'string' ? query['documentId'] : undefined;
			const from = typeof query['from'] === 'string' ? query['from'] : undefined;
			const to = typeof query['to'] === 'string' ? query['to'] : undefined;

			if (!collection || !documentId) {
				res.status(400).json({ error: 'collection and documentId are required' });
				return;
			}

			if (!adapter.query) {
				res.status(501).json({ error: 'Analytics adapter does not support queries' });
				return;
			}

			const documentPath = `/${collection}/${documentId}`;
			const queryFn = adapter.query.bind(adapter);
			const dateRange = { from, to };

			// Query page view events (content-attributed first, URL fallback)
			const pageViewEvents = await queryEventsByDocument(
				queryFn,
				'page_view',
				collection,
				documentId,
				documentPath,
				{ category: 'page', ...dateRange },
			);

			// Aggregate metrics
			const visitorSet = new Set<string>();
			const referrerMap = new Map<string, number>();

			for (const event of pageViewEvents) {
				// Use visitorId (persistent across sessions) as primary identifier,
				// fall back to sessionId when visitorId is unavailable.
				const identifier = event.visitorId ?? event.sessionId;
				if (identifier) visitorSet.add(identifier);

				const referrer = event.context.referrer;
				if (referrer) {
					referrerMap.set(referrer, (referrerMap.get(referrer) ?? 0) + 1);
				}
			}

			// Query block engagement if available
			let blockEngagement: ContentPerformanceData['blockEngagement'];
			try {
				const [impressionEvents, hoverEvents] = await Promise.all([
					queryEventsByDocument(
						queryFn,
						'block_impression',
						collection,
						documentId,
						documentPath,
						dateRange,
					),
					queryEventsByDocument(
						queryFn,
						'block_hover',
						collection,
						documentId,
						documentPath,
						dateRange,
					),
				]);

				const impressionMap = countByBlockType(impressionEvents);
				const hoverMap = countByBlockType(hoverEvents);

				const allTypes = new Set([...impressionMap.keys(), ...hoverMap.keys()]);
				if (allTypes.size > 0) {
					blockEngagement = [];
					for (const blockType of allTypes) {
						blockEngagement.push({
							blockType,
							impressions: impressionMap.get(blockType) ?? 0,
							hovers: hoverMap.get(blockType) ?? 0,
						});
					}
					blockEngagement.sort((a, b) => b.impressions - a.impressions);
				}
			} catch {
				// Block engagement is optional — silently skip
			}

			const topReferrers = [...referrerMap.entries()]
				.map(([referrer, count]) => ({ referrer, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			const data: ContentPerformanceData = {
				pageViews: pageViewEvents.length,
				uniqueVisitors: visitorSet.size,
				topReferrers,
				blockEngagement,
			};

			res.json(data);
		} catch (err) {
			console.error('Content performance query failed:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	return router;
}

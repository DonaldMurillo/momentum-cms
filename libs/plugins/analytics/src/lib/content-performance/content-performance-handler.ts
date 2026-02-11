/**
 * Content Performance Handler
 *
 * Express router that serves per-document analytics data.
 * Aggregates page_view events by URL pattern and document properties.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AnalyticsAdapter } from '../analytics-config.types';
import type { ContentPerformanceData } from './content-performance.types';
import { requireAuth } from '../analytics-auth';

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
 * Create an Express router for the content performance endpoint.
 *
 * @param adapter - Analytics storage adapter (must support query)
 * @returns Express Router
 */
export function createContentPerformanceRouter(adapter: AnalyticsAdapter): Router {
	const router = Router();

	router.get('/content-performance', requireAuth, async (req: Request, res: Response) => {
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

			// Query page_view events that match the document.
			// The adapter `search` is a substring match, so post-filter for exact URL.
			const pageViewResult = await adapter.query({
				category: 'page',
				name: 'page_view',
				search: documentPath,
				from,
				to,
				limit: 1000,
			});
			const pageViewEvents = pageViewResult.events.filter((e) =>
				matchesDocumentUrl(e.context.url, documentPath),
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
				const [impressionResult, hoverResult] = await Promise.all([
					adapter.query({
						name: 'block_impression',
						search: documentPath,
						from,
						to,
						limit: 1000,
					}),
					adapter.query({
						name: 'block_hover',
						search: documentPath,
						from,
						to,
						limit: 1000,
					}),
				]);

				// Post-filter block events for exact document URL match
				const impressionEvents = impressionResult.events.filter((e) =>
					matchesDocumentUrl(e.context.url, documentPath),
				);
				const hoverEvents = hoverResult.events.filter((e) =>
					matchesDocumentUrl(e.context.url, documentPath),
				);

				const impressionMap = new Map<string, number>();
				for (const event of impressionEvents) {
					const bt = String(event.properties['blockType'] ?? 'unknown');
					impressionMap.set(bt, (impressionMap.get(bt) ?? 0) + 1);
				}

				const hoverMap = new Map<string, number>();
				for (const event of hoverEvents) {
					const bt = String(event.properties['blockType'] ?? 'unknown');
					hoverMap.set(bt, (hoverMap.get(bt) ?? 0) + 1);
				}

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

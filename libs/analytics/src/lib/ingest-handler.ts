/**
 * Ingest Handler
 *
 * Express route handler for the client-side analytics ingest endpoint.
 * Validates incoming events, assigns server-side timestamps, and rate limits.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { AnalyticsEvent, AnalyticsCategory } from './analytics-event.types';
import type { EventStore } from './event-store';
import { createLogger } from '@momentum-cms/logger';

const VALID_CATEGORIES: Set<AnalyticsCategory> = new Set([
	'admin',
	'api',
	'content',
	'page',
	'action',
	'custom',
]);

/**
 * Options for the ingest handler.
 */
export interface IngestHandlerOptions {
	/** Event store to buffer events */
	eventStore: EventStore;
	/** Rate limit per IP per minute. @default 100 */
	rateLimit?: number;
}

/**
 * Simple in-memory rate limiter.
 */
class RateLimiter {
	private readonly limits: Map<string, { count: number; resetAt: number }> = new Map();
	private readonly maxPerMinute: number;

	constructor(maxPerMinute: number) {
		this.maxPerMinute = maxPerMinute;
	}

	isAllowed(key: string): boolean {
		const now = Date.now();
		const entry = this.limits.get(key);

		if (!entry || now >= entry.resetAt) {
			this.limits.set(key, { count: 1, resetAt: now + 60_000 });
			return true;
		}

		if (entry.count >= this.maxPerMinute) {
			return false;
		}

		entry.count++;
		return true;
	}
}

/**
 * Validate a single client event.
 */
function isValidClientEvent(event: unknown): event is Partial<AnalyticsEvent> {
	if (event === null || typeof event !== 'object') return false;

	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard narrows from unknown
	const e = event as Record<string, unknown>;
	if (typeof e['name'] !== 'string' || e['name'].length === 0) return false;
	if (e['category'] && !VALID_CATEGORIES.has(e['category'] as AnalyticsCategory)) return false; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- validated by Set.has

	return true;
}

/**
 * Creates an Express router for the analytics ingest endpoint.
 *
 * @param options - Ingest handler options
 * @returns Express router
 */
export function createIngestRouter(options: IngestHandlerOptions): Router {
	const { eventStore, rateLimit = 100 } = options;
	const limiter = new RateLimiter(rateLimit);
	const logger = createLogger('Analytics:Ingest');
	const router = createRouter();

	router.post('/', (req: Request, res: Response) => {
		// Rate limit by IP
		const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
		if (!limiter.isAllowed(ip)) {
			res.status(429).json({ error: 'Rate limit exceeded' });
			return;
		}

		// Validate request body
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express body is parsed JSON
		const body = req.body as Record<string, unknown>;
		if (!body || !Array.isArray(body['events'])) {
			res.status(400).json({ error: 'Request body must contain an events array' });
			return;
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated above
		const rawEvents = body['events'] as unknown[];
		const validEvents: AnalyticsEvent[] = [];

		for (const raw of rawEvents) {
			if (!isValidClientEvent(raw)) {
				continue;
			}

			// raw is now narrowed to Partial<AnalyticsEvent> by the type guard
			const partial = raw;
			const event: AnalyticsEvent = {
				id: randomUUID(),
				category: partial.category ?? 'custom',
				name: partial.name ?? 'unknown',
				// Server-side timestamp (prevents client clock skew)
				timestamp: new Date().toISOString(),
				sessionId: typeof partial.sessionId === 'string' ? partial.sessionId : undefined,
				userId: typeof partial.userId === 'string' ? partial.userId : undefined,
				visitorId: typeof partial.visitorId === 'string' ? partial.visitorId : undefined,
				properties:
					typeof partial.properties === 'object' && partial.properties !== null
						? partial.properties
						: {},
				context: {
					source: 'client',
					url: typeof partial.context?.url === 'string' ? partial.context.url : undefined,
					referrer:
						typeof partial.context?.referrer === 'string' ? partial.context.referrer : undefined,
					userAgent: req.headers['user-agent'],
				},
			};

			validEvents.push(event);
		}

		if (validEvents.length === 0) {
			res.status(400).json({ error: 'No valid events in request' });
			return;
		}

		eventStore.addBatch(validEvents);
		logger.debug(`Ingested ${validEvents.length} client events`);

		res.status(202).json({ accepted: validEvents.length });
	});

	return router;
}

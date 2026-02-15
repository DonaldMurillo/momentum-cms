/**
 * Analytics API routes for the Analog server.
 *
 * Mirrors the Express analytics plugin endpoints:
 * - POST /analytics/collect — ingest client events
 * - GET  /analytics/query — paginated event query (admin)
 * - GET  /analytics/summary — pre-aggregated metrics (admin)
 * - GET  /analytics/content-performance — per-document analytics (admin)
 * - GET  /analytics/tracking-rules — active tracking rules for client (public)
 */

import { randomUUID } from 'node:crypto';
import {
	defineEventHandler,
	readBody,
	getQuery,
	getRouterParams,
	setResponseStatus,
	getHeaders,
} from 'h3';

import type {
	AnalyticsEvent,
	AnalyticsCategory,
	AnalyticsQueryOptions,
} from '@momentum-cms/plugins/analytics';
// eslint-disable-next-line @nx/enforce-module-boundaries -- server route handler uses analytics utilities directly
import { parseUserAgent } from '@momentum-cms/plugins/analytics';
import { getMomentumAPI } from '@momentum-cms/server-core';
import {
	ensureInitialized,
	getAuth,
	analytics,
	analyticsAdapter,
} from '../../../utils/momentum-init';

const VALID_CATEGORIES: Set<string> = new Set([
	'admin',
	'api',
	'content',
	'page',
	'action',
	'custom',
]);

// Rate limiter for ingest endpoint
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

const rateLimiter = new RateLimiter(analytics.analyticsConfig.ingestRateLimit ?? 100);

// Tracking rules cache
let cachedRules: Array<Record<string, unknown>> | null = null;
let cacheTimestamp = 0;
const cacheTtl =
	typeof analytics.analyticsConfig.trackingRules === 'object'
		? (analytics.analyticsConfig.trackingRules.cacheTtl ?? 60_000)
		: 60_000;

/**
 * Resolve user from session for admin checks.
 */
async function resolveUser(
	rawHeaders: Record<string, string | undefined>,
): Promise<{ id: string; role?: string } | null> {
	const auth = getAuth();
	if (!auth) return null;

	try {
		const headers = new Headers();
		for (const [key, value] of Object.entries(rawHeaders)) {
			if (value != null) {
				headers.set(key, value);
			}
		}
		const session = await auth.api.getSession({ headers });
		if (!session) return null;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type
		const userRecord = session.user as Record<string, unknown>;
		return {
			id: session.user.id,
			role: typeof userRecord['role'] === 'string' ? userRecord['role'] : 'user',
		};
	} catch {
		return null;
	}
}

/**
 * Check if URL exactly matches the expected document path.
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
 * Attributes that extractProperties cannot read.
 */
const BLOCKED_EXTRACT_ATTRIBUTES = new Set(['value', 'password', 'autocomplete', 'autofill']);
const MAX_EXTRACT_VALUE_LENGTH = 200;

function isRecord(val: unknown): val is Record<string, unknown> {
	return val != null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Selectors that could target sensitive form inputs.
 */
const BLOCKED_SELECTOR_PATTERNS: RegExp[] = [
	/type\s*=\s*["']?password/i,
	/type\s*=\s*["']?hidden/i,
	/autocomplete\s*=\s*["']?cc-/i,
	/autocomplete\s*=\s*["']?current-password/i,
	/autocomplete\s*=\s*["']?new-password/i,
];

function normalizeCssEscapes(selector: string): string {
	return selector
		.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
			String.fromCodePoint(parseInt(hex, 16)),
		)
		.replace(/\\([^0-9a-fA-F\n])/g, '$1');
}

function stripPseudoWrappers(selector: string): string {
	return selector.replace(/:(is|where|not|has|matches)\s*\(/gi, '(');
}

function isSelectorBlocked(selector: string): boolean {
	const normalized = stripPseudoWrappers(normalizeCssEscapes(selector));
	return BLOCKED_SELECTOR_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeExtractProperties(raw: unknown[]): unknown[] | undefined {
	const sanitized: unknown[] = [];
	for (const entry of raw) {
		if (!isRecord(entry)) continue;
		const source = typeof entry['source'] === 'string' ? entry['source'] : '';
		const attr = typeof entry['attribute'] === 'string' ? entry['attribute'] : '';
		if (source === 'attribute' && BLOCKED_EXTRACT_ATTRIBUTES.has(attr.toLowerCase())) {
			continue;
		}
		sanitized.push({ ...entry, maxLength: MAX_EXTRACT_VALUE_LENGTH });
	}
	return sanitized.length > 0 ? sanitized : undefined;
}

function toClientRule(doc: unknown): Record<string, unknown> | null {
	if (!isRecord(doc)) return null;
	if (typeof doc['name'] !== 'string' || typeof doc['selector'] !== 'string') return null;
	if (isSelectorBlocked(doc['selector'])) return null;

	return {
		name: doc['name'],
		selector: doc['selector'],
		eventType: typeof doc['eventType'] === 'string' ? doc['eventType'] : 'click',
		eventName: typeof doc['eventName'] === 'string' ? doc['eventName'] : '',
		urlPattern: typeof doc['urlPattern'] === 'string' ? doc['urlPattern'] : '*',
		properties: isRecord(doc['properties']) ? doc['properties'] : {},
		extractProperties: Array.isArray(doc['extractProperties'])
			? sanitizeExtractProperties(doc['extractProperties'])
			: undefined,
		active: doc['active'] === true,
		rateLimit: typeof doc['rateLimit'] === 'number' ? doc['rateLimit'] : undefined,
	};
}

export default defineEventHandler(async (event) => {
	await ensureInitialized();

	const method = event.method.toUpperCase();
	const params = getRouterParams(event);
	const pathSegments = (params['analytics'] ?? '').split('/').filter(Boolean);
	const seg0 = pathSegments[0] ?? '';
	const rawHeaders = getHeaders(event);

	// ============================================
	// POST /analytics/collect — ingest client events
	// ============================================
	if (seg0 === 'collect' && method === 'POST') {
		// Rate limit by IP
		const ip = rawHeaders['x-forwarded-for'] ?? rawHeaders['x-real-ip'] ?? 'unknown';
		if (!rateLimiter.isAllowed(ip)) {
			setResponseStatus(event, 429);
			return { error: 'Rate limit exceeded' };
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- h3 body
		const body = (await readBody(event)) as Record<string, unknown>;
		if (!body || !Array.isArray(body['events'])) {
			setResponseStatus(event, 400);
			return { error: 'Request body must contain an events array' };
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated above
		const rawEvents = body['events'] as unknown[];
		const validEvents: AnalyticsEvent[] = [];

		const ua = rawHeaders['user-agent'];
		const parsed = parseUserAgent(ua);
		const clientIp = rawHeaders['x-forwarded-for'] ?? rawHeaders['x-real-ip'];

		for (const raw of rawEvents) {
			if (raw === null || typeof raw !== 'object') continue;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard
			const e = raw as Record<string, unknown>;
			if (typeof e['name'] !== 'string' || e['name'].length === 0) continue;
			if (e['category'] && !VALID_CATEGORIES.has(String(e['category']))) continue;

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated
			const partial = raw as Partial<AnalyticsEvent>;
			const analyticsEvent: AnalyticsEvent = {
				id: randomUUID(),
				category: partial.category ?? 'custom',
				name: partial.name ?? 'unknown',
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
					userAgent: ua,
					ip: clientIp,
					device: parsed.device,
					browser: parsed.browser,
					os: parsed.os,
				},
			};

			validEvents.push(analyticsEvent);
		}

		if (validEvents.length === 0) {
			setResponseStatus(event, 400);
			return { error: 'No valid events in request' };
		}

		analytics.eventStore.addBatch(validEvents);
		setResponseStatus(event, 202);
		return { accepted: validEvents.length };
	}

	// ============================================
	// GET /analytics/query — paginated event query (admin)
	// ============================================
	if (seg0 === 'query' && method === 'GET') {
		const user = await resolveUser(rawHeaders);
		if (!user) {
			setResponseStatus(event, 401);
			return { error: 'Authentication required' };
		}
		if (user.role !== 'admin') {
			setResponseStatus(event, 403);
			return { error: 'Admin access required' };
		}

		try {
			await analytics.eventStore.flush();

			if (!analyticsAdapter.query) {
				setResponseStatus(event, 501);
				return { error: 'Adapter does not support queries' };
			}

			const queryParams = getQuery(event);
			const options: AnalyticsQueryOptions = {};

			if (queryParams['category'] && typeof queryParams['category'] === 'string') {
				if (VALID_CATEGORIES.has(queryParams['category'])) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated above
					options.category = queryParams['category'] as AnalyticsCategory;
				}
			}
			if (queryParams['name'] && typeof queryParams['name'] === 'string') {
				options.name = queryParams['name'];
			}
			if (queryParams['collection'] && typeof queryParams['collection'] === 'string') {
				options.collection = queryParams['collection'];
			}
			if (queryParams['search'] && typeof queryParams['search'] === 'string') {
				options.search = queryParams['search'];
			}
			if (queryParams['from'] && typeof queryParams['from'] === 'string') {
				options.from = queryParams['from'];
			}
			if (queryParams['to'] && typeof queryParams['to'] === 'string') {
				options.to = queryParams['to'];
			}
			if (queryParams['limit'] && typeof queryParams['limit'] === 'string') {
				const limit = parseInt(queryParams['limit'], 10);
				if (!isNaN(limit) && limit > 0 && limit <= 200) {
					options.limit = limit;
				}
			}
			if (queryParams['page'] && typeof queryParams['page'] === 'string') {
				const page = parseInt(queryParams['page'], 10);
				if (!isNaN(page) && page > 0) {
					options.page = page;
				}
			}

			return await analyticsAdapter.query(options);
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Internal server error' };
		}
	}

	// ============================================
	// GET /analytics/summary — pre-aggregated metrics (admin)
	// ============================================
	if (seg0 === 'summary' && method === 'GET') {
		const user = await resolveUser(rawHeaders);
		if (!user) {
			setResponseStatus(event, 401);
			return { error: 'Authentication required' };
		}
		if (user.role !== 'admin') {
			setResponseStatus(event, 403);
			return { error: 'Admin access required' };
		}

		try {
			await analytics.eventStore.flush();

			if (!analyticsAdapter.query) {
				setResponseStatus(event, 501);
				return { error: 'Adapter does not support queries' };
			}

			const queryParams = getQuery(event);
			const queryOptions: AnalyticsQueryOptions = { limit: 10000 };
			if (queryParams['from'] && typeof queryParams['from'] === 'string') {
				queryOptions.from = queryParams['from'];
			}
			if (queryParams['to'] && typeof queryParams['to'] === 'string') {
				queryOptions.to = queryParams['to'];
			}

			const allEvents = await analyticsAdapter.query(queryOptions);
			const events = allEvents.events;

			const byCategory: Record<string, number> = {};
			const byCollection: Record<string, number> = {};
			const contentOps = { created: 0, updated: 0, deleted: 0 };
			let apiRequests = 0;
			let totalDuration = 0;
			const sessions = new Set<string>();
			const visitors = new Set<string>();
			const pageCounts: Record<string, number> = {};
			const referrerCounts: Record<string, number> = {};
			const deviceCounts: Record<string, number> = {};
			const browserCounts: Record<string, number> = {};

			for (const ev of events) {
				byCategory[ev.category] = (byCategory[ev.category] ?? 0) + 1;

				if (ev.context.collection) {
					byCollection[ev.context.collection] = (byCollection[ev.context.collection] ?? 0) + 1;
				}

				if (ev.category === 'content') {
					if (ev.name === 'content_created') contentOps.created++;
					else if (ev.name === 'content_updated') contentOps.updated++;
					else if (ev.name === 'content_deleted') contentOps.deleted++;
				}

				if (ev.category === 'api') {
					apiRequests++;
					if (ev.context.duration != null) {
						totalDuration += ev.context.duration;
					}
				}

				if (ev.sessionId) sessions.add(ev.sessionId);
				if (ev.visitorId) visitors.add(ev.visitorId);
				if (ev.context.url) {
					pageCounts[ev.context.url] = (pageCounts[ev.context.url] ?? 0) + 1;
				}
				if (ev.context.referrer) {
					referrerCounts[ev.context.referrer] = (referrerCounts[ev.context.referrer] ?? 0) + 1;
				}
				if (ev.context.device) {
					deviceCounts[ev.context.device] = (deviceCounts[ev.context.device] ?? 0) + 1;
				}
				if (ev.context.browser) {
					browserCounts[ev.context.browser] = (browserCounts[ev.context.browser] ?? 0) + 1;
				}
			}

			const topPages = Object.entries(pageCounts)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10)
				.map(([url, count]) => ({ url, count }));

			const topReferrers = Object.entries(referrerCounts)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10)
				.map(([referrer, count]) => ({ referrer, count }));

			return {
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
				topPages,
				topReferrers,
				deviceBreakdown: deviceCounts,
				browserBreakdown: browserCounts,
			};
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Internal server error' };
		}
	}

	// ============================================
	// GET /analytics/content-performance (admin)
	// ============================================
	if (seg0 === 'content-performance' && method === 'GET') {
		const user = await resolveUser(rawHeaders);
		if (!user) {
			setResponseStatus(event, 401);
			return { error: 'Authentication required' };
		}
		if (user.role !== 'admin') {
			setResponseStatus(event, 403);
			return { error: 'Admin access required' };
		}

		try {
			const queryParams = getQuery(event);
			const collection =
				typeof queryParams['collection'] === 'string' ? queryParams['collection'] : undefined;
			const documentId =
				typeof queryParams['documentId'] === 'string' ? queryParams['documentId'] : undefined;
			const from = typeof queryParams['from'] === 'string' ? queryParams['from'] : undefined;
			const to = typeof queryParams['to'] === 'string' ? queryParams['to'] : undefined;

			if (!collection || !documentId) {
				setResponseStatus(event, 400);
				return { error: 'collection and documentId are required' };
			}

			if (!analyticsAdapter.query) {
				setResponseStatus(event, 501);
				return { error: 'Analytics adapter does not support queries' };
			}

			const documentPath = `/${collection}/${documentId}`;

			const pageViewResult = await analyticsAdapter.query({
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

			const visitorSet = new Set<string>();
			const referrerMap = new Map<string, number>();

			for (const ev of pageViewEvents) {
				const identifier = ev.visitorId ?? ev.sessionId;
				if (identifier) visitorSet.add(identifier);
				const referrer = ev.context.referrer;
				if (referrer) {
					referrerMap.set(referrer, (referrerMap.get(referrer) ?? 0) + 1);
				}
			}

			// Block engagement
			let blockEngagement:
				| Array<{
						blockType: string;
						impressions: number;
						hovers: number;
				  }>
				| undefined;
			try {
				const [impressionResult, hoverResult] = await Promise.all([
					analyticsAdapter.query({
						name: 'block_impression',
						search: documentPath,
						from,
						to,
						limit: 1000,
					}),
					analyticsAdapter.query({
						name: 'block_hover',
						search: documentPath,
						from,
						to,
						limit: 1000,
					}),
				]);

				const impressionEvents = impressionResult.events.filter((e) =>
					matchesDocumentUrl(e.context.url, documentPath),
				);
				const hoverEvents = hoverResult.events.filter((e) =>
					matchesDocumentUrl(e.context.url, documentPath),
				);

				const impressionMap = new Map<string, number>();
				for (const ev of impressionEvents) {
					const bt = String(ev.properties['blockType'] ?? 'unknown');
					impressionMap.set(bt, (impressionMap.get(bt) ?? 0) + 1);
				}

				const hoverMap = new Map<string, number>();
				for (const ev of hoverEvents) {
					const bt = String(ev.properties['blockType'] ?? 'unknown');
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
				// Block engagement is optional
			}

			const topReferrers = [...referrerMap.entries()]
				.map(([referrer, count]) => ({ referrer, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			return {
				pageViews: pageViewEvents.length,
				uniqueVisitors: visitorSet.size,
				topReferrers,
				blockEngagement,
			};
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Internal server error' };
		}
	}

	// ============================================
	// GET /analytics/tracking-rules — active rules for client (public)
	// ============================================
	if (seg0 === 'tracking-rules' && method === 'GET') {
		try {
			const now = Date.now();

			// Serve from cache if fresh
			if (cachedRules && now - cacheTimestamp < cacheTtl) {
				return { rules: cachedRules };
			}

			let api: ReturnType<typeof getMomentumAPI>;
			try {
				api = getMomentumAPI();
			} catch {
				return { rules: [] };
			}

			const ops = api.collection('tracking-rules');
			if (!ops || !('find' in ops)) {
				return { rules: [] };
			}

			const result = await ops.find({
				where: { active: { equals: true } },
				limit: 500,
			});

			const docs = Array.isArray(result.docs) ? result.docs : [];
			const clientRules = docs
				.map(toClientRule)
				.filter((rule): rule is Record<string, unknown> => rule != null);

			cachedRules = clientRules;
			cacheTimestamp = now;

			return { rules: clientRules };
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Internal server error' };
		}
	}

	// Unknown analytics route
	setResponseStatus(event, 404);
	return { error: 'Not found' };
});

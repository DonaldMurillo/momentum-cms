/**
 * Tracking Rules Endpoint
 *
 * Serves active tracking rules to the client-side rule engine.
 * Includes an in-memory cache to avoid DB hits on every page load.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { MomentumAPI } from '@momentum-cms/core';
import { isRecord } from '../utils/type-guards';
import { isSelectorBlocked } from '../utils/selector-security';

/**
 * Options for the tracking rules endpoint.
 */
export interface TrackingRulesEndpointOptions {
	/** Cache time-to-live in ms. @default 60000 */
	cacheTtl?: number;
}

/**
 * Type guard: check if a collection supports the find operation.
 */
function isFindable(
	val: unknown,
): val is { find(query: Record<string, unknown>): Promise<{ docs?: unknown[] }> } {
	return val != null && typeof val === 'object' && 'find' in val;
}

/**
 * Attributes that extractProperties cannot read (sensitive form/auth data).
 */
const BLOCKED_EXTRACT_ATTRIBUTES = new Set(['value', 'password', 'autocomplete', 'autofill']);

/** Maximum length for extracted property values */
const MAX_EXTRACT_VALUE_LENGTH = 200;

/**
 * Sanitize extractProperties: remove entries targeting blocked attributes,
 * and annotate with max value length.
 */
function sanitizeExtractProperties(raw: unknown[]): unknown[] | undefined {
	const sanitized: unknown[] = [];

	for (const entry of raw) {
		if (!isRecord(entry)) continue;
		const source = typeof entry['source'] === 'string' ? entry['source'] : '';
		const attr = typeof entry['attribute'] === 'string' ? entry['attribute'] : '';

		// Block extraction of sensitive attributes
		if (source === 'attribute' && BLOCKED_EXTRACT_ATTRIBUTES.has(attr.toLowerCase())) {
			continue;
		}

		sanitized.push({ ...entry, maxLength: MAX_EXTRACT_VALUE_LENGTH });
	}

	return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Strip a raw document from the DB into a client-safe tracking rule.
 * Applies security filtering: blocks dangerous selectors and sanitizes
 * extractProperties to prevent data exfiltration.
 */
function toClientRule(doc: unknown): Record<string, unknown> | null {
	if (!isRecord(doc)) return null;
	if (typeof doc['name'] !== 'string' || typeof doc['selector'] !== 'string') return null;

	// Reject rules targeting sensitive form inputs
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

/**
 * Create an Express router for serving tracking rules to the client.
 *
 * @param getApi - Function that returns the MomentumAPI instance (available after onReady)
 * @param options - Endpoint options
 * @returns Express Router
 */
export interface TrackingRulesRouterResult {
	router: Router;
	invalidateCache: () => void;
}

export function createTrackingRulesRouter(
	getApi: () => MomentumAPI | null,
	options: TrackingRulesEndpointOptions = {},
): TrackingRulesRouterResult {
	const router = Router();
	const cacheTtl = options.cacheTtl ?? 60_000;

	let cachedRules: Array<Record<string, unknown>> | null = null;
	let cacheTimestamp = 0;

	function invalidateCache(): void {
		cachedRules = null;
		cacheTimestamp = 0;
	}

	router.get('/tracking-rules', async (_req: Request, res: Response) => {
		try {
			const now = Date.now();

			// Serve from cache if fresh
			if (cachedRules && now - cacheTimestamp < cacheTtl) {
				res.json({ rules: cachedRules });
				return;
			}

			const api = getApi();
			if (!api) {
				res.json({ rules: [] });
				return;
			}

			// Get collection operations
			const ops = api.collection('tracking-rules');
			if (!isFindable(ops)) {
				res.json({ rules: [] });
				return;
			}

			// Fetch active rules from the tracking-rules collection
			const result = await ops.find({
				where: { active: { equals: true } },
				limit: 500,
			});

			const docs = Array.isArray(result.docs) ? result.docs : [];

			// Strip internal fields for client consumption
			const clientRules = docs
				.map(toClientRule)
				.filter((rule): rule is Record<string, unknown> => rule != null);

			cachedRules = clientRules;
			cacheTimestamp = now;

			res.json({ rules: clientRules });
		} catch (err) {
			console.error('Tracking rules query failed:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	return { router, invalidateCache };
}

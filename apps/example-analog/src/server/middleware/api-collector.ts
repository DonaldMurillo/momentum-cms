/**
 * Nitro server middleware that instruments API requests for analytics.
 *
 * Mirrors the Express `createApiCollectorMiddleware` from the analytics plugin.
 * Fires an `api_request` event after each API response with timing, status code,
 * and parsed user-agent context.
 */

import { defineEventHandler, getRequestURL, getHeaders } from 'h3';
import { randomUUID } from 'node:crypto';

import type { AnalyticsEvent } from '@momentumcms/plugins/analytics';
// eslint-disable-next-line @nx/enforce-module-boundaries -- server middleware uses analytics utilities directly
import { parseUserAgent } from '@momentumcms/plugins/analytics';
import { analytics } from '../utils/momentum-init';

export default defineEventHandler((event) => {
	const url = getRequestURL(event);

	// Only instrument /api/ routes (skip static assets, auth, etc.)
	if (!url.pathname.startsWith('/api/')) return;

	// Skip analytics endpoints to avoid infinite loops
	if (url.pathname.startsWith('/api/analytics/')) return;
	if (url.pathname.startsWith('/api/test-analytics-events')) return;

	const startTime = Date.now();
	const method = event.method;
	const rawHeaders = getHeaders(event);
	const ua = rawHeaders['user-agent'];
	const parsed = parseUserAgent(ua);
	const ip = rawHeaders['x-forwarded-for'] ?? rawHeaders['x-real-ip'] ?? undefined;
	const referrer = rawHeaders['referer'] ?? rawHeaders['referrer'] ?? undefined;

	// Hook into the response finish event
	event.node.res.on('finish', () => {
		const duration = Date.now() - startTime;
		const statusCode = event.node.res.statusCode;

		const analyticsEvent: AnalyticsEvent = {
			id: randomUUID(),
			category: 'api',
			name: 'api_request',
			timestamp: new Date().toISOString(),
			properties: {
				method,
				path: url.pathname,
			},
			context: {
				source: 'server',
				url: url.href,
				referrer,
				userAgent: ua,
				ip,
				device: parsed.device,
				browser: parsed.browser,
				os: parsed.os,
				duration,
				statusCode,
			},
		};

		analytics.eventStore.add(analyticsEvent);
	});
});

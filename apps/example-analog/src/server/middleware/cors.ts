import { defineEventHandler, setResponseHeader, getRequestURL, getRequestHeader } from 'h3';
import momentumConfig from '../../momentum.config';

/**
 * Nitro server middleware for CORS headers on API routes.
 * Mirrors the Express CORS middleware from momentumApiMiddleware.
 */
export default defineEventHandler((event) => {
	const url = getRequestURL(event);

	// Only apply CORS to /api/ routes
	if (!url.pathname.startsWith('/api/')) return;

	const corsConfig = momentumConfig.server?.cors ?? {};
	const origins = Array.isArray(corsConfig.origin)
		? corsConfig.origin
		: corsConfig.origin
			? [corsConfig.origin]
			: [];

	let allowOrigin: string;
	if (origins.length === 0) {
		allowOrigin = '*';
	} else {
		const requestOrigin = getRequestHeader(event, 'origin') ?? '';
		allowOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0];
	}

	setResponseHeader(event, 'Access-Control-Allow-Origin', allowOrigin);
	if (allowOrigin !== '*') {
		setResponseHeader(event, 'Vary', 'Origin');
	}
	setResponseHeader(
		event,
		'Access-Control-Allow-Methods',
		corsConfig.methods?.join(', ') ?? 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
	);
	setResponseHeader(
		event,
		'Access-Control-Allow-Headers',
		corsConfig.headers?.join(', ') ?? 'Content-Type, Authorization',
	);

	// Handle preflight requests
	if (event.method === 'OPTIONS') {
		event.node.res.statusCode = 204;
		event.node.res.end();
		return;
	}
});

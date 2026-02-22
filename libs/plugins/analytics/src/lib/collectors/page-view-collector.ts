/**
 * Page View Collector
 *
 * Express middleware that tracks SSR page view timing and context.
 * Mounted at the application root to intercept page renders.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AnalyticsEvent } from '../analytics-event.types';
import type { PageViewTrackingOptions } from '../analytics-config.types';
import { parseUserAgent } from '../utils/parse-user-agent';
import {
	compileContentRoutes,
	matchContentRoute,
	type CompiledContentRoute,
} from '../utils/content-route-matcher';

/**
 * Callback type for page view event emission.
 */
export type PageViewEmitter = (event: AnalyticsEvent) => void;

/** Default file extensions to exclude from page view tracking. */
const DEFAULT_EXCLUDE_EXTENSIONS: ReadonlySet<string> = new Set([
	'.js',
	'.css',
	'.ico',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.svg',
	'.webp',
	'.avif',
	'.woff',
	'.woff2',
	'.ttf',
	'.eot',
	'.map',
	'.json',
	'.xml',
	'.txt',
	'.mp4',
	'.webm',
	'.ogg',
	'.mp3',
]);

/** Paths that are always excluded (prefix match). */
const ALWAYS_EXCLUDED_PREFIXES: readonly string[] = [
	'/api/',
	'/admin',
	'/__vite',
	'/@fs/',
	'/@id/',
	'/.analog/',
	'/node_modules/',
];

/** Paths that are always excluded (exact match). */
const ALWAYS_EXCLUDED_EXACT: ReadonlySet<string> = new Set([
	'/api',
	'/favicon.ico',
	'/robots.txt',
	'/sitemap.xml',
	'/sitemap-index.xml',
	'/health',
	'/healthz',
	'/ready',
	'/.well-known/security.txt',
]);

/** Common bot user-agent patterns. */
const BOT_PATTERN =
	/bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|applebot|duckduckbot|yandex|baidu|sogou|ia_archiver|semrush|ahref|mj12bot|dotbot|petalbot|bytespider/i;

/**
 * Check whether a user-agent string belongs to a known bot.
 */
export function isBot(ua: string | undefined): boolean {
	if (!ua) return false;
	return BOT_PATTERN.test(ua);
}

/**
 * Check whether a request path should be excluded from page view tracking.
 */
export function shouldExcludePath(
	path: string,
	excludeExtensions: ReadonlySet<string>,
	excludePaths: readonly string[],
): boolean {
	// Always-excluded exact paths
	if (ALWAYS_EXCLUDED_EXACT.has(path)) return true;

	// Always-excluded prefixes
	for (const prefix of ALWAYS_EXCLUDED_PREFIXES) {
		if (path.startsWith(prefix)) return true;
	}

	// User-configured exclude paths (prefix match)
	for (const pattern of excludePaths) {
		if (path.startsWith(pattern)) return true;
	}

	// File extension check
	const dotIndex = path.lastIndexOf('.');
	if (dotIndex !== -1) {
		const ext = path.slice(dotIndex).toLowerCase();
		if (excludeExtensions.has(ext)) return true;
	}

	return false;
}

/**
 * Extract userId from req.user using type guards.
 */
function extractUserId(req: Request): string | undefined {
	if (!('user' in req)) return undefined;
	const user: unknown = req['user'];
	if (user == null || typeof user !== 'object') return undefined;
	if (!('id' in user)) return undefined;
	// After 'id' in user check, TS narrows to object & Record<"id", unknown>
	const id: unknown = user.id;
	return typeof id === 'string' ? id : undefined;
}

/**
 * Creates Express middleware that tracks SSR page view metrics.
 *
 * @param emitter - Callback to emit analytics events
 * @param options - Page view tracking options
 * @returns Express middleware function
 */
export function createPageViewCollectorMiddleware(
	emitter: PageViewEmitter,
	options: PageViewTrackingOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
	const excludeExtensions: ReadonlySet<string> = options.excludeExtensions
		? new Set(options.excludeExtensions)
		: DEFAULT_EXCLUDE_EXTENSIONS;
	const excludePaths: readonly string[] = options.excludePaths ?? [];
	const onlySuccessful = options.onlySuccessful !== false;
	const trackBots = options.trackBots === true;

	// Compile content routes once at creation time (not per-request)
	const compiledRoutes: readonly CompiledContentRoute[] | undefined = options.contentRoutes
		? compileContentRoutes(options.contentRoutes)
		: undefined;

	return (req: Request, res: Response, next: NextFunction): void => {
		// Only track GET requests (page navigations)
		if (req.method !== 'GET') {
			next();
			return;
		}

		const path = req.path;

		// Path exclusion (checked early, before attaching response listener)
		if (shouldExcludePath(path, excludeExtensions, excludePaths)) {
			next();
			return;
		}

		// Bot detection (checked early)
		const ua = req.headers['user-agent'];
		if (!trackBots && isBot(ua)) {
			next();
			return;
		}

		const start = Date.now();

		// Hook into response finish once to avoid double-emission
		res.once('finish', () => {
			// Status code filter
			if (onlySuccessful && (res.statusCode < 200 || res.statusCode >= 300)) {
				return;
			}

			const duration = Date.now() - start;
			const parsed = parseUserAgent(ua);
			const refHeader = req.headers['referer'] ?? req.headers['referrer'];
			const referrer = Array.isArray(refHeader) ? refHeader[0] : refHeader;

			// Content route matching — enrich with collection/slug when configured
			let contentCollection: string | undefined;
			let contentSlug: string | undefined;
			if (compiledRoutes) {
				const routeMatch = matchContentRoute(path, compiledRoutes);
				if (routeMatch) {
					contentCollection = routeMatch.collection;
					contentSlug = routeMatch.params['slug'];
				}
			}

			const event: AnalyticsEvent = {
				id: randomUUID(),
				category: 'page',
				name: 'page_view',
				timestamp: new Date().toISOString(),
				userId: extractUserId(req),
				properties: {
					method: req.method,
					path,
					statusCode: res.statusCode,
					...(contentCollection != null ? { collection: contentCollection } : {}),
					...(contentSlug != null ? { slug: contentSlug } : {}),
				},
				context: {
					source: 'server',
					url: req.originalUrl,
					referrer,
					userAgent: ua,
					ip: req.ip ?? req.socket.remoteAddress,
					device: parsed.device,
					browser: parsed.browser,
					os: parsed.os,
					duration,
					statusCode: res.statusCode,
					...(contentCollection != null ? { collection: contentCollection } : {}),
				},
			};

			emitter(event);
		});

		next();
	};
}

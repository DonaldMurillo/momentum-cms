/**
 * Cache Middleware
 *
 * Express middleware that intercepts GET requests to collection and global
 * endpoints, serves cached responses, and captures misses for caching.
 * Handles ETag/If-None-Match for 304 responses and sets Cache-Control headers.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { CacheAdapter, CacheEntry } from './cache-adapter.types';
import type { CachePluginConfig, CollectionCacheConfig } from './cache-plugin-config.types';
import type { CacheHeaders } from './cdn-headers';
import type { CacheUserContext } from './cache-key';
import type { PluginLogger } from '@momentumcms/core';
import {
	resolveScope,
	collectionCacheKey,
	globalCacheKey,
	filterQueryParams,
	KNOWN_CMS_QUERY_PARAMS,
} from './cache-key';
import { generateEtag, matchesEtag } from './etag';
import { buildCacheHeaders } from './cdn-headers';

/**
 * Extract user from Express request (set by auth middleware on `req.user`).
 */
function getUser(req: Request): CacheUserContext | undefined {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express req is extended by auth middleware
	const user = (req as unknown as Record<string, unknown>)['user'];
	if (user && typeof user === 'object' && 'id' in user) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated by checks above
		return user as CacheUserContext;
	}
	return undefined;
}

/**
 * Extract the If-None-Match header value from the request.
 */
function getIfNoneMatch(req: Request): string | undefined {
	const header = req.headers['if-none-match'];
	return Array.isArray(header) ? header[0] : header;
}

/**
 * Apply cache headers to the response.
 */
function applyHeaders(res: Response, headers: CacheHeaders): void {
	for (const [k, v] of Object.entries(headers)) {
		if (v) res.setHeader(k, v);
	}
}

/**
 * Serve a cached response, handling ETag/304 negotiation and cache headers.
 * Returns true if the response was sent (hit or 304), false if caller should proceed.
 */
function serveCachedResponse(
	req: Request,
	res: Response,
	cached: CacheEntry,
	scope: string,
	ttl: number,
	collConfig: CollectionCacheConfig | undefined,
	cdnConfig: CachePluginConfig['cdn'],
	etagsEnabled: boolean,
): boolean {
	if (etagsEnabled && cached.etag) {
		res.setHeader('ETag', cached.etag);
		if (matchesEtag(getIfNoneMatch(req), cached.etag)) {
			applyHeaders(res, buildCacheHeaders(scope, ttl, collConfig, cdnConfig));
			res.status(304).end();
			return true;
		}
	}

	applyHeaders(res, buildCacheHeaders(scope, ttl, collConfig, cdnConfig));
	res.status(200).json(cached.value);
	return true;
}

/**
 * Set up the response interceptor for cache misses.
 * Only caches successful (2xx) responses.
 */
function cacheOnMiss(
	res: Response,
	adapter: CacheAdapter,
	key: string,
	tags: string[],
	ttl: number,
	scope: string,
	collConfig: CollectionCacheConfig | undefined,
	cdnConfig: CachePluginConfig['cdn'],
	etagsEnabled: boolean,
): void {
	interceptResponse(res, (body) => {
		if (res.statusCode >= 200 && res.statusCode < 300) {
			const etag = etagsEnabled ? generateEtag(body) : undefined;
			const entry: CacheEntry = {
				value: body,
				etag,
				tags,
				createdAt: Date.now(),
				ttl,
			};
			void adapter.set(key, entry);

			if (etagsEnabled && etag) res.setHeader('ETag', etag);
			applyHeaders(res, buildCacheHeaders(scope, ttl, collConfig, cdnConfig));
		}
	});
}

/**
 * Express middleware that requires admin role. Returns true if blocked.
 */
function requireAdmin(req: Request, res: Response): boolean {
	const user = getUser(req);
	if (!user || user.role !== 'admin') {
		res.status(403).json({ error: 'Admin access required' });
		return true;
	}
	return false;
}

/**
 * Creates Express middleware that caches GET responses.
 * Also handles write-through invalidation for globals.
 */
export function createCacheMiddleware(
	adapter: CacheAdapter,
	config: CachePluginConfig,
	collectionSlugs: Set<string>,
	globalSlugs: Set<string>,
	excludeSet: Set<string>,
	logger: PluginLogger | undefined,
	invalidateGlobal?: (slug: string) => Promise<void>,
): Router {
	const router = Router();
	const defaultTtl = config.defaultTtl ?? 60;
	const defaultScope = config.defaultScope ?? 'user';
	const etagsEnabled = config.etags !== false;
	const logHitMiss = config.logHitMiss ?? false;
	const allowedParams = config.allowedQueryParams ?? KNOWN_CMS_QUERY_PARAMS;

	// Cache GET requests to globals
	router.get('/globals/:slug', async (req: Request, res: Response, next: NextFunction) => {
		// C1: Skip cache entirely for X-API-Key requests — the API key resolver
		// runs AFTER cache middleware, so req.user isn't set yet. Caching these
		// responses would poison the cache with unauthenticated-scoped data
		// that actually contains privileged results.
		if (req.headers['x-api-key']) {
			next();
			return;
		}

		const slug = req.params['slug'];
		if (!slug || !globalSlugs.has(slug)) {
			next();
			return;
		}

		const globalConfig = config.globals?.[slug];
		if (globalConfig?.enabled === false) {
			next();
			return;
		}

		const scopeConfig = globalConfig?.scope ?? defaultScope;
		const scope = resolveScope(getUser(req), scopeConfig);
		const ttl = globalConfig?.ttl ?? defaultTtl;
		const key = globalCacheKey(scope, slug);

		const cached = await adapter.get(key);
		if (cached) {
			if (logHitMiss && logger) logger.debug(`Cache HIT: ${key}`);
			serveCachedResponse(req, res, cached, scope, ttl, undefined, config.cdn, etagsEnabled);
			return;
		}

		if (logHitMiss && logger) logger.debug(`Cache MISS: ${key}`);
		cacheOnMiss(
			res,
			adapter,
			key,
			[`global:${slug}`],
			ttl,
			scope,
			undefined,
			config.cdn,
			etagsEnabled,
		);
		next();
	});

	// Invalidate globals cache on write operations (post-write)
	// Intercepts res.end() (the lowest-level response method) so invalidation
	// fires regardless of how the handler sends the response — res.json(),
	// res.send(), res.status(204).end(), etc. The response is flushed
	// immediately; invalidation runs fire-and-forget so cache backend
	// latency never delays the HTTP response.
	if (invalidateGlobal) {
		const invalidationTimeout = config.invalidationTimeout ?? 5000;
		const writeHandler = (req: Request, res: Response, next: NextFunction): void => {
			const slug = req.params['slug'];
			if (slug && globalSlugs.has(slug)) {
				const originalEnd = res.end;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express res.end() has complex overloads
				(res as any).end = function (this: Response, ...args: any[]): Response {
					// Flush the response immediately — never hold it hostage to cache backend latency
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- res.end() overloads make tuple typing impractical
					(originalEnd as (...a: unknown[]) => void).apply(this, args);

					// M6: Only invalidate on successful writes — failed auth/access
					// returns 4xx/5xx which must NOT flush the cache (DoS prevention)
					if (this.statusCode >= 200 && this.statusCode < 300) {
						// M1: Race invalidation against a timeout so hung Redis connections
						// don't leak promises indefinitely
						// eslint-disable-next-line local/no-direct-browser-apis -- server-side Express middleware, not Angular
						const timeout = new Promise<void>((resolve) =>
							setTimeout(resolve, invalidationTimeout),
						);
						void Promise.race([invalidateGlobal(slug), timeout]);
					}
					return this;
				};
			}
			next();
		};
		router.put('/globals/:slug', writeHandler);
		router.patch('/globals/:slug', writeHandler);
		router.delete('/globals/:slug', writeHandler);
		router.post('/globals/:slug', writeHandler);
	}

	// Cache GET requests to collections
	router.get('/:collection/:id?', async (req: Request, res: Response, next: NextFunction) => {
		// C1: Skip cache for X-API-Key requests (same reason as globals above)
		if (req.headers['x-api-key']) {
			next();
			return;
		}

		const collection = req.params['collection'];
		if (!collection || !collectionSlugs.has(collection) || excludeSet.has(collection)) {
			next();
			return;
		}

		const collConfig = config.collections?.[collection];
		if (collConfig?.enabled === false) {
			next();
			return;
		}

		const scopeConfig = collConfig?.scope ?? defaultScope;
		const scope = resolveScope(getUser(req), scopeConfig);
		const ttl = collConfig?.ttl ?? defaultTtl;
		const id = req.params['id'];

		// Filter to known CMS params only — unknown params are stripped to
		// prevent cache thrashing via arbitrary junk params (DoS vector)
		const rawQuery: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(req.query)) {
			if (v !== undefined) rawQuery[k] = v;
		}
		const queryParams = filterQueryParams(rawQuery, allowedParams);

		const key = collectionCacheKey(scope, collection, id, queryParams);

		const cached = await adapter.get(key);
		if (cached) {
			if (logHitMiss && logger) logger.debug(`Cache HIT: ${key}`);
			serveCachedResponse(req, res, cached, scope, ttl, collConfig, config.cdn, etagsEnabled);
			return;
		}

		if (logHitMiss && logger) logger.debug(`Cache MISS: ${key}`);
		cacheOnMiss(res, adapter, key, [collection], ttl, scope, collConfig, config.cdn, etagsEnabled);
		next();
	});

	return router;
}

/**
 * Intercept res.json() to capture the response body before it's sent.
 */
function interceptResponse(res: Response, onBody: (body: unknown) => void): void {
	const originalJson = res.json.bind(res);
	res.json = function interceptedJson(body: unknown): Response {
		try {
			onBody(body);
		} catch {
			// Don't let caching errors break the response
		}
		return originalJson(body);
	};
}

/**
 * Creates Express router for cache management endpoints.
 */
export function createCacheManagementRouter(adapter: CacheAdapter): Router {
	const router = Router();

	// GET /cache/stats — Return cache statistics
	router.get('/stats', async (req: Request, res: Response) => {
		if (requireAdmin(req, res)) return;
		const stats = await adapter.stats();
		res.json(stats);
	});

	// POST /cache/purge — Purge cache (all or by tag)
	router.post('/purge', async (req: Request, res: Response) => {
		if (requireAdmin(req, res)) return;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express body typing
		const body = (req.body ?? {}) as Record<string, unknown>;
		const tag = typeof body['tag'] === 'string' ? body['tag'] : undefined;
		if (tag) {
			const count = await adapter.deleteByTag(tag);
			res.json({ purged: count, tag });
		} else {
			await adapter.clear();
			res.json({ purged: 'all' });
		}
	});

	return router;
}

/**
 * Cache Plugin Configuration Types
 */

import type { CacheAdapter } from './cache-adapter.types';

/**
 * Cache scope strategy for determining cache key isolation.
 */
export type CacheScope = 'public' | 'role' | 'user';

/**
 * CDN-specific cache configuration.
 */
export interface CdnConfig {
	/** CDN TTL in seconds (used in Surrogate-Control). @default matches collection TTL */
	maxAge?: number;
	/** Stale-while-revalidate window in seconds */
	staleWhileRevalidate?: number;
}

/**
 * Per-collection cache configuration.
 */
export interface CollectionCacheConfig {
	/** Enable/disable caching for this collection. @default true */
	enabled?: boolean;

	/** Time-to-live in seconds. @default uses plugin defaultTtl */
	ttl?: number;

	/**
	 * Cache scope strategy.
	 * - 'public': Same cache for all users (fully public collections)
	 * - 'role': Cache varies by user role
	 * - 'user': Cache varies by user ID (most restrictive, safest default)
	 * @default uses plugin defaultScope
	 */
	scope?: CacheScope;

	/** CDN-specific overrides */
	cdn?: {
		maxAge?: number;
		staleWhileRevalidate?: number;
		surrogateKeys?: string[];
	};

	/** Additional Vary headers beyond the defaults */
	varyHeaders?: string[];
}

/**
 * Cache plugin configuration.
 */
export interface CachePluginConfig {
	/** Cache adapter. @default LRUCacheAdapter with maxSize 1000 */
	adapter?: CacheAdapter;

	/** Default TTL for all collections in seconds. @default 60 */
	defaultTtl?: number;

	/** Default cache scope. @default 'user' */
	defaultScope?: CacheScope;

	/** Per-collection overrides keyed by slug */
	collections?: Record<string, CollectionCacheConfig>;

	/** Global caching overrides keyed by slug */
	globals?: Record<string, Pick<CollectionCacheConfig, 'enabled' | 'ttl' | 'scope'>>;

	/** Collections to exclude from caching. Auth collections are auto-excluded. */
	excludeCollections?: string[];

	/**
	 * Query parameters included in cache keys. Unknown params are stripped
	 * to prevent cache thrashing via arbitrary junk params.
	 * @default KNOWN_CMS_QUERY_PARAMS ('limit', 'page', 'sort', 'depth', 'where', ...)
	 */
	allowedQueryParams?: string[];

	/** Maximum number of items in LRU cache. @default 1000 */
	maxSize?: number;

	/** Enable ETag support. @default true */
	etags?: boolean;

	/** Enable CDN headers (Cache-Control, Surrogate-Control). @default false */
	cdn?: boolean | CdnConfig;

	/** Enable admin dashboard page. @default true */
	adminDashboard?: boolean;

	/** Log cache hits/misses. @default false */
	logHitMiss?: boolean;

	/** Timeout in ms for global write invalidation. Prevents hung connections from blocking responses. @default 5000 */
	invalidationTimeout?: number;
}

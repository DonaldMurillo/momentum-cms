/**
 * Cache Adapter Interface
 *
 * Defines the pluggable backend contract for API response caching.
 * Implementations: LRUCacheAdapter (in-memory), RedisCacheAdapter (optional).
 */

/**
 * A cached entry with metadata.
 */
export interface CacheEntry<T = unknown> {
	/** The cached value */
	value: T;
	/** Weak ETag for conditional requests */
	etag?: string;
	/** Tags for targeted invalidation (e.g., collection slug) */
	tags: string[];
	/** Unix timestamp (ms) when the entry was created */
	createdAt: number;
	/** Time-to-live in seconds */
	ttl: number;
	/** Original Content-Type header captured at cache time. Replayed on hit so
	 * non-JSON responses (text/plain, application/xml, pre-serialized JSON via
	 * `res.end()`, etc.) keep their original content type and bytes. */
	contentType?: string;
	/** Optional metadata for collision detection and debugging.
	 * Stores the original query hash and parameters so consumers can verify
	 * that a cache hit corresponds to the correct query. */
	metadata?: {
		/** Hash of the original query parameters */
		queryHash?: string;
		/** Original query parameters (for collision verification) */
		query?: Record<string, unknown>;
	};
}

/**
 * Cache statistics.
 */
export interface CacheStats {
	/** Total number of cached entries */
	size: number;
	/** Cache hit count since startup */
	hits: number;
	/** Cache miss count since startup */
	misses: number;
	/** Hit rate as a percentage (0-100) */
	hitRate: number;
	/** Total memory used in bytes (if available) */
	memoryUsage?: number;
	/** Number of entries evicted (LRU) */
	evictions?: number;
}

/**
 * Pluggable cache backend.
 *
 * Adapters must support key-based get/set/delete, tag-based invalidation,
 * and statistics reporting.
 */
export interface CacheAdapter {
	/** Get a cached value by key. Returns undefined on miss or TTL expiry. */
	get<T = unknown>(key: string): Promise<CacheEntry<T> | undefined>;

	/** Set a cached value with TTL. */
	set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void>;

	/** Delete a single key. Returns true if the key existed. */
	delete(key: string): Promise<boolean>;

	/** Delete all entries tagged with a specific tag. Returns count of deleted entries. */
	deleteByTag(tag: string): Promise<number>;

	/** Clear the entire cache. */
	clear(): Promise<void>;

	/** Get cache statistics. */
	stats(): Promise<CacheStats>;

	/** Optional initialization (e.g., Redis connection). */
	initialize?(): Promise<void>;

	/** Optional shutdown (e.g., close Redis connection). */
	shutdown?(): Promise<void>;
}

// Cache adapter types
export type { CacheAdapter, CacheEntry, CacheStats } from './lib/cache-adapter.types';

// Cache config types
export type {
	CachePluginConfig,
	CollectionCacheConfig,
	CdnConfig,
	CacheScope,
} from './lib/cache-plugin-config.types';

// Cache key utilities
export {
	fnv1a,
	resolveScope,
	hashQuery,
	collectionCacheKey,
	globalCacheKey,
	type CacheUserContext,
} from './lib/cache-key';

// ETag utilities
export { generateEtag, matchesEtag } from './lib/etag';

// CDN header builders
export { buildCacheHeaders, type CacheHeaders } from './lib/cdn-headers';

// Invalidation
export { buildDependencyGraph, injectCacheInvalidationHooks } from './lib/invalidation';

// Cache middleware
export { createCacheMiddleware, createCacheManagementRouter } from './lib/cache-middleware';

// Adapters
export { LRUCacheAdapter, type LRUCacheAdapterOptions } from './lib/adapters/lru-adapter';
export {
	RedisCacheAdapter,
	type RedisCacheAdapterOptions,
	type RedisClient,
} from './lib/adapters/redis-adapter';

// Cache plugin
export { cachePlugin, type CachePluginInstance } from './lib/cache-plugin';

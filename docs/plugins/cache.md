# Cache

`@momentumcms/plugins/cache` provides API response caching with ETags, tag-based invalidation, and in-memory or Redis-backed adapters.

## Redis `maxKeys`

`RedisCacheAdapter` accepts an optional `maxKeys` limit. When the adapter believes it is at capacity, it reconciles the actual Redis entry count before dropping a new key. This matters because Redis expires `SETEX` keys independently; after TTL expiry, capacity should be available again without restarting the server.

The reconciliation only runs at the `maxKeys` boundary. Normal cache writes do not scan Redis.

```typescript
import { RedisCacheAdapter } from '@momentumcms/plugins/cache';

const adapter = new RedisCacheAdapter({
	redis: process.env.REDIS_URL!,
	maxKeys: 10_000,
});
```

If Redis is still truly at capacity after reconciliation, the adapter silently skips the new entry.

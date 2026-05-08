/**
 * Redis Cache Adapter
 *
 * Uses ioredis for Redis-backed caching with tag-based invalidation.
 * ioredis is an optional peer dependency.
 */

import type { CacheAdapter, CacheEntry, CacheStats } from '../cache-adapter.types';

/**
 * Minimal Redis client interface matching ioredis methods we use.
 * This avoids requiring ioredis at compile time.
 */
export interface RedisClient {
	get(key: string): Promise<string | null>;
	setex(key: string, ttl: number, value: string): Promise<string>;
	del(...keys: string[]): Promise<number>;
	sadd(key: string, ...members: string[]): Promise<number>;
	srem(key: string, ...members: string[]): Promise<number>;
	smembers(key: string): Promise<string[]>;
	/** Set a key's TTL in seconds. */
	expire(key: string, ttl: number): Promise<number>;
	keys(pattern: string): Promise<string[]>;
	scan(cursor: string, ...args: string[]): Promise<[string, string[]]>;
	flushdb(): Promise<string>;
	quit(): Promise<string>;
	pipeline(): RedisPipeline;
	/**
	 * Execute a Redis Lua script atomically via EVAL.
	 * This is the standard ioredis eval() method — NOT JavaScript eval().
	 * Used for atomic cache operations (set + tag management in a single round-trip).
	 */
	eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>;
}

export interface RedisPipeline {
	del(key: string): RedisPipeline;
	run(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface RedisCacheAdapterOptions {
	/** ioredis instance or connection URL */
	redis: RedisClient | string;
	/** Key prefix. @default 'momentum:cache:' */
	prefix?: string;
	/** Maximum number of cache entries. When reached, new entries are silently dropped. */
	maxKeys?: number;
}

export class RedisCacheAdapter implements CacheAdapter {
	private client: RedisClient | null = null;
	private readonly redisOption: RedisClient | string;
	private readonly prefix: string;
	private readonly maxKeys: number | undefined;
	private hits = 0;
	private misses = 0;
	private entryCount = 0;

	constructor(options: RedisCacheAdapterOptions) {
		this.redisOption = options.redis;
		this.prefix = options.prefix ?? 'momentum:cache:';
		this.maxKeys = options.maxKeys;
	}

	async initialize(): Promise<void> {
		if (typeof this.redisOption === 'string') {
			// Dynamic import to keep ioredis optional
			const ioredisModule = await import('ioredis');
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic import of optional peer dep
			const RedisConstructor = ioredisModule.default as unknown as new (url: string) => RedisClient;
			this.client = new RedisConstructor(this.redisOption);
		} else {
			this.client = this.redisOption;
		}
	}

	async shutdown(): Promise<void> {
		if (this.client && typeof this.redisOption === 'string') {
			await this.client.quit();
		}
		this.client = null;
	}

	async get<T = unknown>(key: string): Promise<CacheEntry<T> | undefined> {
		const client = this.requireClient();
		const raw = await client.get(this.prefix + key);
		if (!raw) {
			this.misses++;
			return undefined;
		}

		let entry: CacheEntry<T>;
		try {
			entry = JSON.parse(raw) as CacheEntry<T>; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
		} catch {
			// Corrupt entry — treat as miss, clean up
			this.misses++;
			await client.del(this.prefix + key);
			return undefined;
		}
		// TTL expiry is handled by Redis SETEX — if the key exists, it's valid
		this.hits++;
		return entry;
	}

	/**
	 * Atomically set a cache entry with tag management via Lua script.
	 * The Lua script: reads old entry → cleans old tags → SETEX new entry →
	 * SADD + EXPIRE new tags — all in a single atomic Redis operation.
	 */
	async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
		const client = this.requireClient();
		const fullKey = this.prefix + key;
		const ttl = Math.max(1, Math.ceil(entry.ttl));

		// Read existing entry to determine if new (for maxKeys) and discover old tags
		const existingRaw = await client.get(fullKey);
		const isNewKey = !existingRaw;

		if (isNewKey && this.maxKeys !== undefined && this.entryCount >= this.maxKeys) {
			// Redis expires SETEX keys without notifying this adapter, so the local
			// counter can drift upward. Reconcile only at the capacity boundary so
			// normal writes avoid SCAN, but expired capacity is reclaimed.
			const actualStats = await this.stats();
			this.entryCount = actualStats.size;
			if (this.entryCount >= this.maxKeys) {
				return;
			}
		}

		// Pass prefix to Lua so it can construct old tag keys dynamically.
		// This prevents a race where the pre-read misses old tags that were
		// written by a concurrent set() between the pre-read and the eval.
		await client.eval(
			LUA_SET_SCRIPT,
			1,
			fullKey,
			JSON.stringify(entry),
			String(ttl),
			this.prefix,
			...entry.tags,
		);

		if (isNewKey) this.entryCount++;
	}

	/**
	 * Atomically delete a cache entry and clean up its tag references via Lua script.
	 */
	async delete(key: string): Promise<boolean> {
		const client = this.requireClient();
		const fullKey = this.prefix + key;

		// Read entry to discover its tags (needed for Lua KEYS)
		const raw = await client.get(fullKey);
		if (!raw) return false;

		let entry: CacheEntry;
		try {
			entry = JSON.parse(raw) as CacheEntry; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
		} catch {
			// Corrupt entry — delete the key directly and return
			await client.del(fullKey);
			this.entryCount = Math.max(0, this.entryCount - 1);
			return true;
		}
		const tagKeys = entry.tags.map((t) => this.prefix + 'tag:' + t);
		const numkeys = 1 + tagKeys.length;
		const allKeys = [fullKey, ...tagKeys];

		const result = await client.eval(LUA_DELETE_SCRIPT, numkeys, ...allKeys);

		if (result) this.entryCount = Math.max(0, this.entryCount - 1);
		return !!result;
	}

	/**
	 * Atomically delete all entries for a tag, cleaning up cross-tag references.
	 * Returns only the count of entries that actually existed (excludes stale refs).
	 */
	async deleteByTag(tag: string): Promise<number> {
		const client = this.requireClient();
		const tagKey = this.prefix + 'tag:' + tag;
		const members = await client.smembers(tagKey);
		if (members.length === 0) return 0;

		// Discover all cross-tags for Lua KEYS param
		const crossTagKeys = new Set<string>();
		crossTagKeys.add(tagKey);
		const liveMembers: string[] = [];

		for (const memberKey of members) {
			const raw = await client.get(memberKey);
			if (raw) {
				let entry: CacheEntry;
				try {
					entry = JSON.parse(raw) as CacheEntry; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
				} catch {
					// Corrupt entry — mark as stale so it gets cleaned up
					continue;
				}
				liveMembers.push(memberKey);
				for (const otherTag of entry.tags) {
					if (otherTag !== tag) {
						crossTagKeys.add(this.prefix + 'tag:' + otherTag);
					}
				}
			}
		}

		// Clean up stale members from the tag set before deletion
		const staleMembers = members.filter((m) => !liveMembers.includes(m));
		if (staleMembers.length > 0) {
			await client.srem(tagKey, ...staleMembers);
		}

		if (liveMembers.length === 0) {
			// All references were stale — just delete the empty tag set
			await client.del(tagKey);
			return 0;
		}

		const tagKeysArray = [...crossTagKeys];
		const allKeys = [...tagKeysArray, ...liveMembers];

		// ARGV: [tagName, numTagKeys] — numTagKeys tells Lua where tag keys end and member keys begin
		const deleted = await client.eval(
			LUA_DELETE_BY_TAG_SCRIPT,
			allKeys.length,
			...allKeys,
			tag,
			String(tagKeysArray.length),
		);

		const count = typeof deleted === 'number' ? deleted : liveMembers.length;
		this.entryCount = Math.max(0, this.entryCount - count);
		return count;
	}

	async clear(): Promise<void> {
		const client = this.requireClient();
		const keys = await this.scanKeys(client, this.prefix + '*');
		if (keys.length > 0) {
			await client.del(...keys);
		}
		this.entryCount = 0;
	}

	async stats(): Promise<CacheStats> {
		const client = this.requireClient();
		const allKeys = await this.scanKeys(client, this.prefix + '*');
		// Exclude tag keys from size count
		const entryKeys = allKeys.filter((k) => !k.startsWith(this.prefix + 'tag:'));
		const total = this.hits + this.misses;
		return {
			size: entryKeys.length,
			hits: this.hits,
			misses: this.misses,
			hitRate: total === 0 ? 0 : (this.hits / total) * 100,
		};
	}

	/**
	 * Cursor-based SCAN to avoid blocking Redis with KEYS.
	 */
	private async scanKeys(client: RedisClient, pattern: string): Promise<string[]> {
		const result: string[] = [];
		let cursor = '0';
		do {
			const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
			cursor = nextCursor;
			result.push(...keys);
		} while (cursor !== '0');
		return result;
	}

	private requireClient(): RedisClient {
		if (!this.client) {
			throw new Error('RedisCacheAdapter not initialized. Call initialize() first.');
		}
		return this.client;
	}
}

// ── Lua Scripts ──────────────────────────────────────────────────
// These run atomically inside Redis, preventing race conditions
// between concurrent cache operations.

/**
 * Atomic SET: read old entry → clean old tag refs → SETEX new → SADD + EXPIRE new tags.
 * KEYS: [fullKey]
 * ARGV: [json, ttl, prefix, tagName1, tagName2, ...]
 * Tag keys are constructed dynamically from prefix to handle concurrent overwrites
 * where the pre-read may not reflect the current state.
 */
const LUA_SET_SCRIPT = `-- CACHE_SET
local fullKey = KEYS[1]
local json = ARGV[1]
local ttl = tonumber(ARGV[2])
local prefix = ARGV[3]

-- Clean up old tag associations (reads current state atomically)
local existing = redis.call('GET', fullKey)
if existing then
  local oldEntry = cjson.decode(existing)
  if oldEntry.tags then
    for _, oldTag in ipairs(oldEntry.tags) do
      redis.call('SREM', prefix .. 'tag:' .. oldTag, fullKey)
    end
  end
end

-- Write new entry with TTL
redis.call('SETEX', fullKey, ttl, json)

-- Add to tag sets and set TTL to MAX of current and new (prevents premature expiry)
for i = 4, #ARGV do
  local tagKey = prefix .. 'tag:' .. ARGV[i]
  redis.call('SADD', tagKey, fullKey)
  local currentTTL = redis.call('TTL', tagKey)
  if currentTTL < ttl then
    redis.call('EXPIRE', tagKey, ttl)
  end
end

return 'OK'
`;

/**
 * Atomic DELETE: read entry → SREM from all tags → DEL key.
 * KEYS: [fullKey, tagKey1, tagKey2, ...]
 */
const LUA_DELETE_SCRIPT = `-- CACHE_DELETE
local fullKey = KEYS[1]
local raw = redis.call('GET', fullKey)
if not raw then return 0 end

local ok, entry = pcall(cjson.decode, raw)
if ok and entry and entry.tags then
  for _, tag in ipairs(entry.tags) do
    local suffix = 'tag:' .. tag
    for i = 2, #KEYS do
      if KEYS[i]:sub(-#suffix) == suffix then
        redis.call('SREM', KEYS[i], fullKey)
        break
      end
    end
  end
end

redis.call('DEL', fullKey)
return 1
`;

/**
 * Atomic DELETE_BY_TAG: for each live member, clean cross-tag refs → DEL members + tag set.
 * KEYS: [tagKey, crossTagKey1, ..., memberKey1, memberKey2, ...]
 * ARGV: [tagName]
 */
/**
 * Atomic DELETE_BY_TAG: for each live member, clean cross-tag refs → DEL members + primary tag.
 * KEYS: [primaryTagKey, crossTagKey1, ..., memberKey1, memberKey2, ...]
 * ARGV: [tagName, numTagKeys]
 * numTagKeys tells us how many of the KEYS are tag sets (starting from index 1).
 * Only the PRIMARY tag key (KEYS[1]) is deleted — cross-tag sets are only SREM'd.
 */
const LUA_DELETE_BY_TAG_SCRIPT = `-- CACHE_DELETE_BY_TAG
local tag = ARGV[1]
local numTagKeys = tonumber(ARGV[2])
local deleted = 0

-- Process member keys (everything after the tag keys)
for i = numTagKeys + 1, #KEYS do
  local memberKey = KEYS[i]
  local raw = redis.call('GET', memberKey)
  if raw then
    local ok, entry = pcall(cjson.decode, raw)
    if ok and entry and entry.tags then
      for _, otherTag in ipairs(entry.tags) do
        if otherTag ~= tag then
          local suffix = 'tag:' .. otherTag
          for j = 1, numTagKeys do
            if KEYS[j]:sub(-#suffix) == suffix then
              redis.call('SREM', KEYS[j], memberKey)
              break
            end
          end
        end
      end
    end
    redis.call('DEL', memberKey)
    deleted = deleted + 1
  end
end

-- Delete ONLY the primary tag set (KEYS[1]), NOT cross-tag sets
redis.call('DEL', KEYS[1])

return deleted
`;

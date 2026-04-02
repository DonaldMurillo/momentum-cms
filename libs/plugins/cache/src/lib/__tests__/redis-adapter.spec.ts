import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCacheAdapter } from '../adapters/redis-adapter';
import type { RedisClient } from '../adapters/redis-adapter';
import type { CacheEntry } from '../cache-adapter.types';

function makeEntry<T>(value: T, opts?: Partial<CacheEntry<T>>): CacheEntry<T> {
	return {
		value,
		tags: opts?.tags ?? ['test'],
		createdAt: opts?.createdAt ?? Date.now(),
		ttl: opts?.ttl ?? 60,
		etag: opts?.etag,
	};
}

interface MockRedisInternals {
	store: Map<string, string>;
	sets: Map<string, Set<string>>;
	/** Simulate Redis TTL expiry by removing a key from the store directly */
	simulateExpiry(key: string): void;
}

function createMockRedis(): RedisClient & MockRedisInternals {
	const store = new Map<string, string>();
	const sets = new Map<string, Set<string>>();

	const mock: RedisClient & MockRedisInternals = {
		store,
		sets,
		simulateExpiry(key: string) {
			store.delete(key);
		},
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		setex: vi.fn(async (key: string, _ttl: number, value: string) => {
			store.set(key, value);
			return 'OK';
		}),
		del: vi.fn(async (...keys: string[]) => {
			let count = 0;
			for (const key of keys) {
				if (store.delete(key) || sets.delete(key)) count++;
			}
			return count;
		}),
		sadd: vi.fn(async (key: string, ...members: string[]) => {
			let s = sets.get(key);
			if (!s) {
				s = new Set();
				sets.set(key, s);
			}
			let added = 0;
			for (const m of members) {
				if (!s.has(m)) {
					s.add(m);
					added++;
				}
			}
			return added;
		}),
		srem: vi.fn(async (key: string, ...members: string[]) => {
			const s = sets.get(key);
			if (!s) return 0;
			let removed = 0;
			for (const m of members) {
				if (s.delete(m)) removed++;
			}
			if (s.size === 0) sets.delete(key);
			return removed;
		}),
		smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
		expire: vi.fn(async (_key: string, _ttl: number) => 1),
		keys: vi.fn(async (pattern: string) => {
			const prefix = pattern.replace('*', '');
			const allKeys = [...store.keys(), ...sets.keys()];
			return allKeys.filter((k) => k.startsWith(prefix));
		}),
		scan: vi.fn(async (_cursor: string, ..._args: string[]) => {
			// Extract MATCH pattern from args: ['MATCH', pattern, 'COUNT', '100']
			const matchIdx = _args.indexOf('MATCH');
			const pattern = matchIdx >= 0 ? (_args[matchIdx + 1] ?? '') : '';
			const prefix = pattern.replace('*', '');
			const allKeys = [...store.keys(), ...sets.keys()];
			const matched = allKeys.filter((k) => k.startsWith(prefix));
			// Return all results in one batch (cursor '0' means done)
			return ['0', matched] as [string, string[]];
		}),
		flushdb: vi.fn(async () => {
			store.clear();
			sets.clear();
			return 'OK';
		}),
		quit: vi.fn(async () => 'OK'),
		pipeline: vi.fn(() => {
			const ops: Array<() => void> = [];
			const pipe = {
				del: (key: string) => {
					ops.push(() => {
						store.delete(key);
						sets.delete(key);
					});
					return pipe;
				},
				run: async () => {
					for (const op of ops) op();
					return ops.map(() => [null, 1] as [null, number]);
				},
			};
			return pipe;
		}),
		// Mock Redis EVAL: simulates Lua script execution atomically.
		// Operates SYNCHRONOUSLY on store/sets to prevent microtask interleaving,
		// matching real Redis Lua script atomicity. Calls expire spy for Bug #4 tests.
		eval: vi.fn((script: string, numkeys: number, ...args: string[]) => {
			const keys = args.slice(0, numkeys);
			const scriptArgs = args.slice(numkeys);

			if (script.includes('-- CACHE_SET')) {
				// KEYS: [fullKey], ARGV: [json, ttl, prefix, ...tagNames]
				const fullKey = keys[0] ?? '';
				const json = scriptArgs[0] ?? '';
				const ttl = parseInt(scriptArgs[1] ?? '0', 10);
				const prefix = scriptArgs[2] ?? '';
				const tagNames = scriptArgs.slice(3);

				// Clean old tag associations (reads current store atomically)
				const existing = store.get(fullKey);
				if (existing) {
					const oldEntry = JSON.parse(existing) as CacheEntry;
					for (const oldTag of oldEntry.tags) {
						const tagKey = prefix + 'tag:' + oldTag;
						const s = sets.get(tagKey);
						if (s) {
							s.delete(fullKey);
							if (s.size === 0) sets.delete(tagKey);
						}
					}
				}

				// SETEX
				store.set(fullKey, json);

				// SADD + EXPIRE for each tag
				for (const tagName of tagNames) {
					const tagKey = prefix + 'tag:' + tagName;
					let s = sets.get(tagKey);
					if (!s) {
						s = new Set();
						sets.set(tagKey, s);
					}
					s.add(fullKey);
					// Call expire spy so Bug #4 tests can verify it
					void mock.expire(tagKey, ttl);
				}

				return Promise.resolve('OK');
			}

			// IMPORTANT: Check CACHE_DELETE_BY_TAG before CACHE_DELETE (more specific first)
			if (script.includes('-- CACHE_DELETE_BY_TAG')) {
				const primaryTag = scriptArgs[0] ?? '';
				const numTagKeys = parseInt(scriptArgs[1] ?? '1', 10);
				const tagKeys = keys.slice(0, numTagKeys);
				const memberKeys = keys.slice(numTagKeys);

				if (memberKeys.length === 0) {
					if (tagKeys[0]) sets.delete(tagKeys[0]);
					return Promise.resolve(0);
				}

				let deleted = 0;
				for (const memberKey of memberKeys) {
					const raw = store.get(memberKey);
					if (raw) {
						const entry = JSON.parse(raw) as CacheEntry;
						for (const otherTag of entry.tags) {
							if (otherTag !== primaryTag) {
								const suffix = 'tag:' + otherTag;
								const otherTagKey = tagKeys.find((k) => k.endsWith(suffix));
								if (otherTagKey) {
									const s = sets.get(otherTagKey);
									if (s) {
										s.delete(memberKey);
										if (s.size === 0) sets.delete(otherTagKey);
									}
								}
							}
						}
						store.delete(memberKey);
						deleted++;
					}
				}
				// Only delete primary tag set
				if (tagKeys[0]) sets.delete(tagKeys[0]);
				return Promise.resolve(deleted);
			}

			if (script.includes('-- CACHE_DELETE')) {
				const fullKey = keys[0] ?? '';
				const raw = store.get(fullKey);
				if (!raw) return Promise.resolve(0);

				const entry = JSON.parse(raw) as CacheEntry;
				for (const tag of entry.tags) {
					const tagKey = keys.find((k) => k.endsWith('tag:' + tag));
					if (tagKey) {
						const s = sets.get(tagKey);
						if (s) {
							s.delete(fullKey);
							if (s.size === 0) sets.delete(tagKey);
						}
					}
				}
				store.delete(fullKey);
				return Promise.resolve(1);
			}

			return Promise.resolve(null);
		}),
	};

	return mock;
}

describe('RedisCacheAdapter', () => {
	let adapter: RedisCacheAdapter;
	let mockRedis: RedisClient & MockRedisInternals;

	beforeEach(async () => {
		mockRedis = createMockRedis();
		adapter = new RedisCacheAdapter({ redis: mockRedis });
		await adapter.initialize();
	});

	it('should throw if not initialized', async () => {
		const freshAdapter = new RedisCacheAdapter({ redis: 'redis://fake' });
		await expect(freshAdapter.get('key')).rejects.toThrow('not initialized');
	});

	it('should store and retrieve entries', async () => {
		const entry = makeEntry({ foo: 'bar' });
		await adapter.set('key1', entry);
		const result = await adapter.get('key1');
		expect(result?.value).toEqual({ foo: 'bar' });
	});

	it('should return undefined on miss', async () => {
		expect(await adapter.get('missing')).toBeUndefined();
	});

	it('should delete entries', async () => {
		await adapter.set('key1', makeEntry('val'));
		expect(await adapter.delete('key1')).toBe(true);
		expect(await adapter.get('key1')).toBeUndefined();
	});

	it('should delete by tag', async () => {
		await adapter.set('k1', makeEntry('v1', { tags: ['posts'] }));
		await adapter.set('k2', makeEntry('v2', { tags: ['posts'] }));
		await adapter.set('k3', makeEntry('v3', { tags: ['users'] }));

		const count = await adapter.deleteByTag('posts');
		expect(count).toBe(2);
		expect(await adapter.get('k1')).toBeUndefined();
		expect(await adapter.get('k2')).toBeUndefined();
		expect(await adapter.get('k3')).toBeDefined();
	});

	it('should clear all entries', async () => {
		await adapter.set('k1', makeEntry('v1'));
		await adapter.set('k2', makeEntry('v2'));
		await adapter.clear();

		const stats = await adapter.stats();
		expect(stats.size).toBe(0);
	});

	it('should track hit/miss stats', async () => {
		await adapter.set('k1', makeEntry('v1'));
		await adapter.get('k1'); // hit
		await adapter.get('missing'); // miss

		const stats = await adapter.stats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.hitRate).toBe(50);
	});

	it('should rely on Redis SETEX for TTL (entry returned if not expired by Redis)', async () => {
		// Redis handles TTL via SETEX. Our mock doesn't expire, so the entry should be returned.
		const entry = makeEntry('still-valid', { ttl: 60 });
		await adapter.set('ttl-test', entry);
		const result = await adapter.get('ttl-test');
		expect(result?.value).toBe('still-valid');
	});

	it('should shutdown gracefully', async () => {
		// Using client directly (not URL), should not call quit
		await adapter.shutdown();
		expect(mockRedis.quit).not.toHaveBeenCalled();
	});

	it('should only delete prefixed keys on clear, not other keys in the database', async () => {
		// Simulate another service's data in the same Redis database
		await mockRedis.setex('other-service:session:abc', 3600, 'session-data');
		await mockRedis.setex('other-service:queue:job1', 600, 'job-data');

		// Store cache entries via the adapter
		await adapter.set('k1', makeEntry('v1'));
		await adapter.set('k2', makeEntry('v2'));

		// Verify cache entries exist
		expect(await adapter.get('k1')).toBeDefined();
		expect(await adapter.get('k2')).toBeDefined();

		// Clear the cache
		await adapter.clear();

		// Cache entries should be gone
		const stats = await adapter.stats();
		expect(stats.size).toBe(0);

		// Other service keys should still exist
		expect(await mockRedis.get('other-service:session:abc')).toBe('session-data');
		expect(await mockRedis.get('other-service:queue:job1')).toBe('job-data');
	});

	it('should clean up old tag sets when overwriting an entry with different tags', async () => {
		// Set entry with tags [posts, featured]
		await adapter.set('k1', makeEntry('v1', { tags: ['posts', 'featured'] }));

		// Overwrite with different tags [users]
		await adapter.set('k1', makeEntry('v2', { tags: ['users'] }));

		// Invalidating old tag 'posts' should NOT affect the entry (it no longer has that tag)
		await adapter.deleteByTag('posts');
		expect(await adapter.get('k1')).toBeDefined();
		expect((await adapter.get('k1'))?.value).toBe('v2');

		// Invalidating old tag 'featured' should also NOT affect the entry
		await adapter.deleteByTag('featured');
		expect(await adapter.get('k1')).toBeDefined();

		// Invalidating new tag 'users' SHOULD delete the entry
		await adapter.deleteByTag('users');
		expect(await adapter.get('k1')).toBeUndefined();
	});

	it('should clean up cross-tag references when deleting by tag (issue #3)', async () => {
		// Step 1: Store entry with multiple tags
		await adapter.set('k1', makeEntry('v1', { tags: ['posts', 'featured'] }));

		// Step 2: Delete by one tag — should remove entry AND clean up 'featured' tag set
		await adapter.deleteByTag('posts');
		expect(await adapter.get('k1')).toBeUndefined();

		// Step 3: Store a NEW entry at the same key with completely different tags
		await adapter.set('k1', makeEntry('v2', { tags: ['users'] }));

		// Step 4: Deleting by the OLD tag 'featured' should NOT delete the new entry
		// because the old entry was already removed and cross-tag refs should have been cleaned
		await adapter.deleteByTag('featured');
		const result = await adapter.get('k1');
		expect(result).toBeDefined();
		expect(result?.value).toBe('v2');
	});

	it('should clean up tag references when deleting a single key', async () => {
		// Store entry with multiple tags
		await adapter.set('k1', makeEntry('v1', { tags: ['posts', 'featured'] }));

		// Delete the key directly
		await adapter.delete('k1');

		// Store a new entry at the same key with different tags
		await adapter.set('k1', makeEntry('v2', { tags: ['users'] }));

		// Deleting by old tag 'posts' should NOT delete the new entry
		await adapter.deleteByTag('posts');
		expect(await adapter.get('k1')).toBeDefined();
		expect((await adapter.get('k1'))?.value).toBe('v2');
	});

	it('should use scan instead of keys for clear()', async () => {
		await adapter.set('k1', makeEntry('v1'));
		await adapter.set('k2', makeEntry('v2'));

		await adapter.clear();

		// Verify keys() was never called (KEYS blocks Redis in production)
		expect(mockRedis.keys).not.toHaveBeenCalled();

		const stats = await adapter.stats();
		expect(stats.size).toBe(0);
	});

	it('should use scan instead of keys for stats()', async () => {
		await adapter.set('k1', makeEntry('v1'));

		await adapter.stats();

		// Verify keys() was never called (KEYS blocks Redis in production)
		expect(mockRedis.keys).not.toHaveBeenCalled();
	});

	// ── Bug #4: Tag set TTL leak ───────────────────────────────────

	describe('tag set TTL and stale reference cleanup (Bug #4)', () => {
		it('should call expire on tag sets when storing entries', async () => {
			await adapter.set('k1', makeEntry('v1', { tags: ['posts'], ttl: 120 }));

			// expire should be called on the tag set key with at least the entry TTL
			expect(mockRedis.expire).toHaveBeenCalledWith('momentum:cache:tag:posts', 120);
		});

		it('should return accurate count from deleteByTag excluding TTL-expired stale references', async () => {
			await adapter.set('k1', makeEntry('v1', { tags: ['posts'] }));
			await adapter.set('k2', makeEntry('v2', { tags: ['posts'] }));

			// Simulate k1 TTL expiry — Redis auto-removed the data key
			mockRedis.simulateExpiry('momentum:cache:k1');

			// deleteByTag should only count k2 (the one that actually existed)
			const count = await adapter.deleteByTag('posts');
			expect(count).toBe(1);
		});

		it('should clean stale references from tag set during deleteByTag', async () => {
			await adapter.set('k1', makeEntry('v1', { tags: ['posts'] }));

			// Simulate expiry
			mockRedis.simulateExpiry('momentum:cache:k1');

			await adapter.deleteByTag('posts');

			// Tag set should be fully cleaned — no stale refs
			const members = await mockRedis.smembers('momentum:cache:tag:posts');
			expect(members).toEqual([]);
		});
	});

	// ── Bug #5: maxKeys limit ──────────────────────────────────────

	describe('maxKeys limit (Bug #5)', () => {
		it('should not store new entries when maxKeys limit is reached', async () => {
			const limitedRedis = createMockRedis();
			const limitedAdapter = new RedisCacheAdapter({ redis: limitedRedis, maxKeys: 2 });
			await limitedAdapter.initialize();

			await limitedAdapter.set('k1', makeEntry('v1'));
			await limitedAdapter.set('k2', makeEntry('v2'));
			await limitedAdapter.set('k3', makeEntry('v3'));

			// k3 should not be stored (at limit)
			expect(await limitedAdapter.get('k3')).toBeUndefined();
			// k1, k2 should still exist
			expect(await limitedAdapter.get('k1')).toBeDefined();
			expect(await limitedAdapter.get('k2')).toBeDefined();
		});

		it('should allow new entries after deleting when at maxKeys limit', async () => {
			const limitedRedis = createMockRedis();
			const limitedAdapter = new RedisCacheAdapter({ redis: limitedRedis, maxKeys: 2 });
			await limitedAdapter.initialize();

			await limitedAdapter.set('k1', makeEntry('v1'));
			await limitedAdapter.set('k2', makeEntry('v2'));
			await limitedAdapter.delete('k1');
			await limitedAdapter.set('k3', makeEntry('v3'));

			expect(await limitedAdapter.get('k3')).toBeDefined();
		});

		it('should allow overwriting existing key when at maxKeys limit', async () => {
			const limitedRedis = createMockRedis();
			const limitedAdapter = new RedisCacheAdapter({ redis: limitedRedis, maxKeys: 2 });
			await limitedAdapter.initialize();

			await limitedAdapter.set('k1', makeEntry('v1'));
			await limitedAdapter.set('k2', makeEntry('v2'));

			// Overwrite k1 — should succeed since it's not a new key
			await limitedAdapter.set('k1', makeEntry('v1-updated'));

			expect((await limitedAdapter.get('k1'))?.value).toBe('v1-updated');
		});

		it('should allow new entries after deleteByTag frees space', async () => {
			const limitedRedis = createMockRedis();
			const limitedAdapter = new RedisCacheAdapter({ redis: limitedRedis, maxKeys: 2 });
			await limitedAdapter.initialize();

			await limitedAdapter.set('k1', makeEntry('v1', { tags: ['posts'] }));
			await limitedAdapter.set('k2', makeEntry('v2', { tags: ['posts'] }));
			await limitedAdapter.deleteByTag('posts');
			await limitedAdapter.set('k3', makeEntry('v3'));

			expect(await limitedAdapter.get('k3')).toBeDefined();
		});
	});

	// ── Bug #3: Non-atomic operations ──────────────────────────────

	describe('atomic operations via eval (Bug #3)', () => {
		it('should use eval for set() operations', async () => {
			await adapter.set('k1', makeEntry('v1', { tags: ['posts'] }));

			expect(mockRedis.eval).toHaveBeenCalled();
		});

		it('should use eval for delete() operations', async () => {
			await adapter.set('k1', makeEntry('v1'));
			vi.mocked(mockRedis.eval).mockClear();

			await adapter.delete('k1');

			expect(mockRedis.eval).toHaveBeenCalled();
		});

		it('should use eval for deleteByTag() operations', async () => {
			await adapter.set('k1', makeEntry('v1', { tags: ['posts'] }));
			vi.mocked(mockRedis.eval).mockClear();

			await adapter.deleteByTag('posts');

			expect(mockRedis.eval).toHaveBeenCalled();
		});

		it('should maintain consistent tag state after concurrent set() on the same key', async () => {
			const entryA = makeEntry('valueA', { tags: ['tagA'] });
			const entryB = makeEntry('valueB', { tags: ['tagB'] });

			// Run two set() calls concurrently for the same key
			await Promise.all([adapter.set('shared', entryA), adapter.set('shared', entryB)]);

			// One of the two should have won
			const result = await adapter.get<string>('shared');
			expect(result).toBeDefined();

			// The tag sets must be consistent with whichever entry won
			if (result?.value === 'valueA') {
				// tagA set should contain 'shared', tagB should NOT
				const tagAMembers = await mockRedis.smembers('momentum:cache:tag:tagA');
				const tagBMembers = await mockRedis.smembers('momentum:cache:tag:tagB');
				expect(tagAMembers).toContain('momentum:cache:shared');
				expect(tagBMembers).not.toContain('momentum:cache:shared');
			} else {
				// tagB set should contain 'shared', tagA should NOT
				const tagAMembers = await mockRedis.smembers('momentum:cache:tag:tagA');
				const tagBMembers = await mockRedis.smembers('momentum:cache:tag:tagB');
				expect(tagBMembers).toContain('momentum:cache:shared');
				expect(tagAMembers).not.toContain('momentum:cache:shared');
			}
		});
	});
});

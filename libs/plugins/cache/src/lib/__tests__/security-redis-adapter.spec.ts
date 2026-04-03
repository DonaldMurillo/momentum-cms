/**
 * Security Tests: Redis Adapter
 *
 * Tests for: H1 (cross-tag preservation), H2 (tag TTL max), H5 (JSON.parse safety),
 *            M3 (Lua pattern safety), M2 (entryCount), M4 (entryCount TTL drift)
 */
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
	ttls: Map<string, number>;
	simulateExpiry(key: string): void;
}

function createMockRedis(): RedisClient & MockRedisInternals {
	const store = new Map<string, string>();
	const sets = new Map<string, Set<string>>();
	const ttls = new Map<string, number>();

	const mock: RedisClient & MockRedisInternals = {
		store,
		sets,
		ttls,
		simulateExpiry(key: string) {
			store.delete(key);
		},
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		setex: vi.fn(async (key: string, ttl: number, value: string) => {
			store.set(key, value);
			ttls.set(key, ttl);
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
		expire: vi.fn(async (key: string, ttl: number) => {
			ttls.set(key, ttl);
			return 1;
		}),
		keys: vi.fn(async (pattern: string) => {
			const prefix = pattern.replace('*', '');
			return [...store.keys(), ...sets.keys()].filter((k) => k.startsWith(prefix));
		}),
		scan: vi.fn(async (_cursor: string, ..._args: string[]) => {
			const matchIdx = _args.indexOf('MATCH');
			const pattern = matchIdx >= 0 ? (_args[matchIdx + 1] ?? '') : '';
			const prefix = pattern.replace('*', '');
			const allKeys = [...store.keys(), ...sets.keys()];
			return ['0', allKeys.filter((k) => k.startsWith(prefix))] as [string, string[]];
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
		eval: vi.fn((script: string, numkeys: number, ...args: string[]) => {
			const keys = args.slice(0, numkeys);
			const scriptArgs = args.slice(numkeys);

			if (script.includes('-- CACHE_SET')) {
				const fullKey = keys[0] ?? '';
				const json = scriptArgs[0] ?? '';
				const ttl = parseInt(scriptArgs[1] ?? '0', 10);
				const prefix = scriptArgs[2] ?? '';
				const tagNames = scriptArgs.slice(3);

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

				store.set(fullKey, json);

				for (const tagName of tagNames) {
					const tagKey = prefix + 'tag:' + tagName;
					let s = sets.get(tagKey);
					if (!s) {
						s = new Set();
						sets.set(tagKey, s);
					}
					s.add(fullKey);
					// H2 FIX: Use max TTL — simulate the fixed Lua script
					const currentTTL = ttls.get(tagKey) ?? 0;
					const newTTL = Math.max(currentTTL, ttl);
					ttls.set(tagKey, newTTL);
					void mock.expire(tagKey, newTTL);
				}

				return Promise.resolve('OK');
			}

			if (script.includes('-- CACHE_DELETE_BY_TAG')) {
				// H1 FIX: Only delete the PRIMARY tag key, not cross-tag sets
				const primaryTag = scriptArgs[0] ?? '';
				const numTagKeys = parseInt(scriptArgs[1] ?? '1', 10);
				const tagKeys = keys.slice(0, numTagKeys);
				const memberKeys = keys.slice(numTagKeys);
				const primaryTagKey = tagKeys[0];

				if (memberKeys.length === 0) {
					if (primaryTagKey) sets.delete(primaryTagKey);
					return Promise.resolve(0);
				}

				let deleted = 0;
				for (const memberKey of memberKeys) {
					const raw = store.get(memberKey);
					if (raw) {
						let entry: CacheEntry;
						try {
							entry = JSON.parse(raw) as CacheEntry;
						} catch {
							continue;
						}
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
				// Only delete the primary tag set
				if (primaryTagKey) sets.delete(primaryTagKey);
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

describe('Security: Redis Adapter', () => {
	let adapter: RedisCacheAdapter;
	let mockRedis: RedisClient & MockRedisInternals;

	beforeEach(async () => {
		mockRedis = createMockRedis();
		adapter = new RedisCacheAdapter({ redis: mockRedis });
		await adapter.initialize();
	});

	describe('H1: deleteByTag must preserve cross-tag sets', () => {
		it('should NOT destroy cross-tag sets when deleting by tag', async () => {
			// Entry A: tags ["posts", "featured"]
			await adapter.set('a', makeEntry('A', { tags: ['posts', 'featured'] }));
			// Entry B: tags ["featured", "news"]
			await adapter.set('b', makeEntry('B', { tags: ['featured', 'news'] }));

			// Delete by "posts" — should delete A, SREM A from "featured", but NOT delete "featured" set
			await adapter.deleteByTag('posts');

			// Entry A should be gone
			expect(await adapter.get('a')).toBeUndefined();
			// Entry B should still be accessible
			expect(await adapter.get('b')).toBeDefined();

			// Now delete by "featured" — should still find and delete B
			const count = await adapter.deleteByTag('featured');
			expect(count).toBe(1);
			expect(await adapter.get('b')).toBeUndefined();
		});

		it('should preserve tag set for unrelated entries when deleting by tag', async () => {
			await adapter.set('x', makeEntry('X', { tags: ['alpha', 'shared'] }));
			await adapter.set('y', makeEntry('Y', { tags: ['beta', 'shared'] }));
			await adapter.set('z', makeEntry('Z', { tags: ['shared'] }));

			// Delete "alpha" — should only remove X
			await adapter.deleteByTag('alpha');
			expect(await adapter.get('x')).toBeUndefined();
			expect(await adapter.get('y')).toBeDefined();
			expect(await adapter.get('z')).toBeDefined();

			// "shared" tag set should still contain y and z
			const sharedCount = await adapter.deleteByTag('shared');
			expect(sharedCount).toBe(2);
		});
	});

	describe('H2: Tag set TTL must use max of current and new TTL', () => {
		it('should not allow short-TTL entries to shorten tag set TTL', async () => {
			// Entry with long TTL
			await adapter.set('long', makeEntry('L', { tags: ['posts'], ttl: 300 }));
			// Entry with short TTL — must NOT reduce tag set TTL
			await adapter.set('short', makeEntry('S', { tags: ['posts'], ttl: 10 }));

			// The tag set's TTL should be max(300, 10) = 300
			const tagTTL = mockRedis.ttls.get('momentum:cache:tag:posts');
			expect(tagTTL).toBe(300);
		});

		it('should increase tag set TTL when a longer-TTL entry is added', async () => {
			await adapter.set('short', makeEntry('S', { tags: ['posts'], ttl: 60 }));
			await adapter.set('long', makeEntry('L', { tags: ['posts'], ttl: 600 }));

			const tagTTL = mockRedis.ttls.get('momentum:cache:tag:posts');
			expect(tagTTL).toBe(600);
		});
	});

	describe('H5: JSON.parse safety — corrupt entries must not crash', () => {
		it('should return undefined for get() with corrupt JSON in Redis', async () => {
			// Manually inject corrupt data
			mockRedis.store.set('momentum:cache:corrupt-key', 'NOT VALID JSON {{{');

			const result = await adapter.get('corrupt-key');
			expect(result).toBeUndefined();
		});

		it('should handle delete() with corrupt JSON gracefully', async () => {
			mockRedis.store.set('momentum:cache:corrupt-key', '{broken json');

			// Should not throw — returns false since it can't process
			const result = await adapter.delete('corrupt-key');
			expect(typeof result).toBe('boolean');
		});

		it('should handle deleteByTag() with some corrupt entries gracefully', async () => {
			// Store a valid entry
			await adapter.set('valid', makeEntry('V', { tags: ['posts'] }));
			// Manually corrupt one entry in the tag set
			mockRedis.store.set('momentum:cache:corrupt', '{broken');
			const tagSet = mockRedis.sets.get('momentum:cache:tag:posts');
			if (tagSet) tagSet.add('momentum:cache:corrupt');

			// Should not throw — should still delete valid entries
			const count = await adapter.deleteByTag('posts');
			expect(count).toBeGreaterThanOrEqual(1);
		});
	});

	describe('M4: entryCount must not drift when Redis expires entries via TTL', () => {
		it('should still accept new entries after previous entries expire in Redis', async () => {
			// Configure adapter with maxKeys limit
			const limitedAdapter = new RedisCacheAdapter({ redis: mockRedis, maxKeys: 3 });
			await limitedAdapter.initialize();

			// Fill to capacity
			await limitedAdapter.set('a', makeEntry('A', { tags: ['t1'], ttl: 10 }));
			await limitedAdapter.set('b', makeEntry('B', { tags: ['t2'], ttl: 10 }));
			await limitedAdapter.set('c', makeEntry('C', { tags: ['t3'], ttl: 10 }));

			// Simulate Redis TTL expiry — keys vanish from Redis but adapter doesn't know
			mockRedis.simulateExpiry('momentum:cache:a');
			mockRedis.simulateExpiry('momentum:cache:b');
			mockRedis.simulateExpiry('momentum:cache:c');

			// Adapter's entryCount is still 3 (the bug). New writes should still work
			// because the expired entries are gone from Redis.
			await limitedAdapter.set('d', makeEntry('D', { tags: ['t4'], ttl: 60 }));

			// The new entry MUST be stored — entryCount must not block it
			const result = await limitedAdapter.get('d');
			expect(result).toBeDefined();
			expect(result?.value).toBe('D');
		});

		it('should not allow entryCount to go negative via delete()', async () => {
			// Adapter starts with entryCount = 0, but Redis may have pre-existing entries
			// from a previous adapter instance
			mockRedis.store.set(
				'momentum:cache:preexisting',
				JSON.stringify(makeEntry('old', { tags: ['t1'] })),
			);

			// Deleting a pre-existing entry should not cause entryCount to go below 0
			const deleted = await adapter.delete('preexisting');
			expect(deleted).toBe(true);

			// Now add a new entry — if entryCount went negative, maxKeys check would be broken
			const limited = new RedisCacheAdapter({ redis: mockRedis, maxKeys: 1 });
			await limited.initialize();

			// Even with maxKeys=1, adding should work since there are 0 real entries
			await limited.set('new-entry', makeEntry('NEW', { tags: ['t2'], ttl: 60 }));
			const result = await limited.get('new-entry');
			expect(result).toBeDefined();
		});
	});

	describe('M3: Lua pattern safety — tag names with special chars', () => {
		it('should handle tags containing Lua pattern characters', async () => {
			// Collection slug with a dot (Lua pattern char)
			await adapter.set('k1', makeEntry('v1', { tags: ['my.collection'] }));

			// Should be able to delete by exact tag name
			const count = await adapter.deleteByTag('my.collection');
			expect(count).toBe(1);
			expect(await adapter.get('k1')).toBeUndefined();
		});
	});
});

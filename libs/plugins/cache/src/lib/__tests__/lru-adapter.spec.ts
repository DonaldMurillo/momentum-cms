import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCacheAdapter } from '../adapters/lru-adapter';
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

describe('LRUCacheAdapter', () => {
	let adapter: LRUCacheAdapter;

	beforeEach(() => {
		adapter = new LRUCacheAdapter({ maxSize: 3 });
	});

	it('should return undefined on cache miss', async () => {
		expect(await adapter.get('missing')).toBeUndefined();
	});

	it('should store and retrieve entries', async () => {
		const entry = makeEntry({ foo: 'bar' });
		await adapter.set('key1', entry);
		const result = await adapter.get('key1');
		expect(result?.value).toEqual({ foo: 'bar' });
	});

	it('should evict least recently used entry when at capacity', async () => {
		await adapter.set('a', makeEntry('A'));
		await adapter.set('b', makeEntry('B'));
		await adapter.set('c', makeEntry('C'));
		// a is LRU, should be evicted when adding d
		await adapter.set('d', makeEntry('D'));

		expect(await adapter.get('a')).toBeUndefined();
		expect((await adapter.get('b'))?.value).toBe('B');
		expect((await adapter.get('d'))?.value).toBe('D');
	});

	it('should promote accessed entries to most recently used', async () => {
		await adapter.set('a', makeEntry('A'));
		await adapter.set('b', makeEntry('B'));
		await adapter.set('c', makeEntry('C'));
		// Access a to make it most recently used
		await adapter.get('a');
		// Now b is LRU
		await adapter.set('d', makeEntry('D'));

		expect(await adapter.get('b')).toBeUndefined(); // evicted
		expect((await adapter.get('a'))?.value).toBe('A'); // still present
	});

	it('should expire entries past TTL', async () => {
		const entry = makeEntry('old', {
			createdAt: Date.now() - 120_000, // 120 seconds ago
			ttl: 60,
		});
		await adapter.set('expired', entry);
		expect(await adapter.get('expired')).toBeUndefined();
	});

	it('should delete by tag', async () => {
		await adapter.set('x1', makeEntry('X1', { tags: ['posts'] }));
		await adapter.set('x2', makeEntry('X2', { tags: ['posts'] }));
		await adapter.set('x3', makeEntry('X3', { tags: ['users'] }));

		const count = await adapter.deleteByTag('posts');
		expect(count).toBe(2);
		expect(await adapter.get('x1')).toBeUndefined();
		expect(await adapter.get('x2')).toBeUndefined();
		expect((await adapter.get('x3'))?.value).toBe('X3');
	});

	it('should return 0 when deleting non-existent tag', async () => {
		expect(await adapter.deleteByTag('ghost')).toBe(0);
	});

	it('should delete a single key', async () => {
		await adapter.set('k', makeEntry('V'));
		expect(await adapter.delete('k')).toBe(true);
		expect(await adapter.get('k')).toBeUndefined();
		expect(await adapter.delete('k')).toBe(false);
	});

	it('should clear all entries', async () => {
		await adapter.set('a', makeEntry('A'));
		await adapter.set('b', makeEntry('B'));
		await adapter.clear();
		expect(await adapter.get('a')).toBeUndefined();
		expect(await adapter.get('b')).toBeUndefined();
	});

	it('should track hit/miss/eviction stats', async () => {
		await adapter.set('a', makeEntry('A'));
		await adapter.get('a'); // hit
		await adapter.get('b'); // miss

		const stats = await adapter.stats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.hitRate).toBe(50);
		expect(stats.size).toBe(1);
	});

	it('should count evictions', async () => {
		await adapter.set('a', makeEntry('A'));
		await adapter.set('b', makeEntry('B'));
		await adapter.set('c', makeEntry('C'));
		await adapter.set('d', makeEntry('D')); // evicts a

		const stats = await adapter.stats();
		expect(stats.evictions).toBe(1);
	});

	it('should handle entries with multiple tags', async () => {
		await adapter.set('multi', makeEntry('M', { tags: ['posts', 'featured'] }));
		await adapter.set('other', makeEntry('O', { tags: ['posts'] }));

		const count = await adapter.deleteByTag('featured');
		expect(count).toBe(1);
		expect(await adapter.get('multi')).toBeUndefined();
		expect((await adapter.get('other'))?.value).toBe('O');
	});

	it('should overwrite existing key without double-counting', async () => {
		await adapter.set('a', makeEntry('V1', { tags: ['t1'] }));
		await adapter.set('a', makeEntry('V2', { tags: ['t2'] }));

		expect((await adapter.get('a'))?.value).toBe('V2');
		// Old tag should be cleaned up
		expect(await adapter.deleteByTag('t1')).toBe(0);
		expect(await adapter.deleteByTag('t2')).toBe(1);
	});
});

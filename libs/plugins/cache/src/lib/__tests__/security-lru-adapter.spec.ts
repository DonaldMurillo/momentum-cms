/**
 * Security Tests: LRU Adapter
 *
 * Tests for: C2 (maxValueSize), H4 (mutable reference isolation)
 */
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

describe('Security: LRU Adapter', () => {
	describe('C2: maxValueSize — prevent memory exhaustion', () => {
		it('should reject entries exceeding maxValueSize', async () => {
			const adapter = new LRUCacheAdapter({ maxSize: 100, maxValueSize: 100 });
			const largeValue = { data: 'x'.repeat(200) };
			await adapter.set('big', makeEntry(largeValue));

			// Entry should not be stored
			expect(await adapter.get('big')).toBeUndefined();
		});

		it('should accept entries within maxValueSize', async () => {
			const adapter = new LRUCacheAdapter({ maxSize: 100, maxValueSize: 1000 });
			const smallValue = { data: 'hello' };
			await adapter.set('small', makeEntry(smallValue));

			expect(await adapter.get('small')).toBeDefined();
			expect((await adapter.get('small'))?.value).toEqual(smallValue);
		});

		it('should have no size limit when maxValueSize is not set', async () => {
			const adapter = new LRUCacheAdapter({ maxSize: 100 });
			const largeValue = { data: 'x'.repeat(100_000) };
			await adapter.set('big', makeEntry(largeValue));

			expect(await adapter.get('big')).toBeDefined();
		});
	});

	describe('H4: Mutable reference isolation', () => {
		let adapter: LRUCacheAdapter;

		beforeEach(() => {
			adapter = new LRUCacheAdapter({ maxSize: 100 });
		});

		it('should return a deep copy on get — mutations must not affect cached value', async () => {
			const original = { nested: { count: 1 }, items: [1, 2, 3] };
			await adapter.set('key1', makeEntry(original));

			// Get the cached value and mutate it
			const result1 = await adapter.get<typeof original>('key1');
			if (!result1) throw new Error('Expected cache hit');
			result1.value.nested.count = 999;
			result1.value.items.push(4);

			// Get again — should be unaffected by the mutation
			const result2 = await adapter.get<typeof original>('key1');
			if (!result2) throw new Error('Expected cache hit');
			expect(result2.value.nested.count).toBe(1);
			expect(result2.value.items).toEqual([1, 2, 3]);
		});

		it('should deep-clone on set — original object mutations must not affect cache', async () => {
			const original = { nested: { value: 'original' } };
			await adapter.set('key1', makeEntry(original));

			// Mutate the original object after caching
			original.nested.value = 'mutated';

			// Cache should still have the original value
			const result = await adapter.get<typeof original>('key1');
			if (!result) throw new Error('Expected cache hit');
			expect(result.value.nested.value).toBe('original');
		});
	});
});

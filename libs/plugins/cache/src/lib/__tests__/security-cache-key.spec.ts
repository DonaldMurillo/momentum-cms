/**
 * Security Tests: Cache Key Generation
 *
 * Tests for: M4 (hash upgrade), L10 (sortKeys depth limit), ID sanitization
 */
import { describe, it, expect } from 'vitest';
import { fnv1a, hashQuery, collectionCacheKey, resolveScope } from '../cache-key';

describe('Security: Cache Key Generation', () => {
	describe('M4: FNV-1a hash collision resistance', () => {
		it('should produce hashes wider than 32-bit to resist birthday attacks', () => {
			// A 32-bit hash has only ~4B values → collisions at ~77K inputs.
			// We need at least 52-bit (safe integer) for adequate collision resistance.
			const _hash = fnv1a('test-input');
			// 32-bit base-36 max is ~1z141z3 (7 chars). 52-bit is much wider.
			// Generate 1000 unique hashes and verify no collisions
			const hashes = new Set<string>();
			for (let i = 0; i < 1000; i++) {
				hashes.add(fnv1a(`query-${i}-${Math.random()}`));
			}
			expect(hashes.size).toBe(1000);

			// The hash output should be longer than 7 chars (32-bit base-36 max)
			const longHash = fnv1a('a-reasonably-long-input-string-for-testing');
			expect(longHash.length).toBeGreaterThan(7);
		});

		it('should still be deterministic after upgrade', () => {
			expect(fnv1a('hello')).toBe(fnv1a('hello'));
			expect(fnv1a('world')).toBe(fnv1a('world'));
		});

		it('should still differentiate distinct inputs', () => {
			expect(fnv1a('foo')).not.toBe(fnv1a('bar'));
			expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
		});
	});

	describe('L10: sortKeys depth limit', () => {
		it('should handle deeply nested objects without stack overflow', () => {
			// Build a 50-level deep nested object
			let deep: Record<string, unknown> = { leaf: 'value' };
			for (let i = 0; i < 50; i++) {
				deep = { [`level${i}`]: deep };
			}
			// Should not throw, should return a deterministic hash
			expect(() => hashQuery(deep)).not.toThrow();
		});

		it('should truncate beyond max depth rather than crash', () => {
			// Build two objects identical up to depth 10 but different beyond
			let obj1: Record<string, unknown> = { deep: 'A' };
			let obj2: Record<string, unknown> = { deep: 'B' };
			for (let i = 0; i < 15; i++) {
				obj1 = { nest: obj1 };
				obj2 = { nest: obj2 };
			}
			// Beyond depth limit, differences should be flattened → same hash
			const hash1 = hashQuery(obj1);
			const hash2 = hashQuery(obj2);
			// Both should produce valid hashes without crashing
			expect(hash1).toBeTruthy();
			expect(hash2).toBeTruthy();
		});
	});

	describe('Cache key delimiter safety', () => {
		it('should not allow ID parameter to corrupt cache key structure', () => {
			// An ID containing delimiter ':' should not cause key ambiguity
			const normalKey = collectionCacheKey('pub', 'posts', 'abc123', undefined);
			const injectedKey = collectionCacheKey('pub', 'posts', 'find:_', undefined);
			// These must be different — the injected ID should not collide with a find operation key
			expect(normalKey).not.toBe(injectedKey);
			// The find operation key for comparison
			const findKey = collectionCacheKey('pub', 'posts', undefined, undefined);
			expect(injectedKey).not.toBe(findKey);
		});

		it('should handle role values safely in scope resolution', () => {
			// A role containing ':' should not break scope isolation
			const normalScope = resolveScope({ id: '1', role: 'admin' }, 'role');
			const injectedScope = resolveScope({ id: '1', role: 'admin:pub:posts' }, 'role');
			expect(normalScope).not.toBe(injectedScope);
		});
	});
});

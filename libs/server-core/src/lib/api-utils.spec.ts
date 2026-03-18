import { describe, it, expect } from 'vitest';
import { deepEqual, stripTransientKeys } from './api-utils';

describe('api-utils', () => {
	describe('deepEqual', () => {
		it('should return true for identical primitives', () => {
			expect(deepEqual(1, 1)).toBe(true);
			expect(deepEqual('hello', 'hello')).toBe(true);
			expect(deepEqual(true, true)).toBe(true);
		});

		it('should return false for different primitives', () => {
			expect(deepEqual(1, 2)).toBe(false);
			expect(deepEqual('a', 'b')).toBe(false);
			expect(deepEqual(true, false)).toBe(false);
		});

		it('should return true for same reference', () => {
			const obj = { a: 1 };
			expect(deepEqual(obj, obj)).toBe(true);
		});

		it('should return true for structurally equal objects', () => {
			expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
		});

		it('should return false for objects with different values', () => {
			expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
		});

		it('should return false for objects with different keys', () => {
			expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
		});

		it('should return false for objects with different key counts', () => {
			expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		});

		it('should handle nested objects', () => {
			expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
			expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toBe(false);
		});

		it('should return true for equal arrays', () => {
			expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
		});

		it('should return false for arrays with different lengths', () => {
			expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
		});

		it('should return false for arrays with different values', () => {
			expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
		});

		it('should return false when comparing array to non-array', () => {
			expect(deepEqual([1], { 0: 1 })).toBe(false);
		});

		it('should return false when comparing non-array to array', () => {
			expect(deepEqual({ 0: 1 }, [1])).toBe(false);
		});

		it('should handle arrays with nested objects', () => {
			expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
			expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
		});

		it('should return false when one side is null', () => {
			expect(deepEqual(null, { a: 1 })).toBe(false);
			expect(deepEqual({ a: 1 }, null)).toBe(false);
		});

		it('should return true when both are null', () => {
			expect(deepEqual(null, null)).toBe(true);
		});

		it('should return false when one side is undefined', () => {
			expect(deepEqual(undefined, { a: 1 })).toBe(false);
			expect(deepEqual({ a: 1 }, undefined)).toBe(false);
		});

		it('should return false for object vs primitive', () => {
			expect(deepEqual({ a: 1 }, 'string')).toBe(false);
			expect(deepEqual(42, { a: 1 })).toBe(false);
		});

		it('should handle empty objects and arrays', () => {
			expect(deepEqual({}, {})).toBe(true);
			expect(deepEqual([], [])).toBe(true);
			expect(deepEqual({}, [])).toBe(false);
		});

		it('should check hasOwnProperty (not inherited keys)', () => {
			const a = { a: 1 };
			const b = Object.create({ a: 1 });
			// b has 'a' on prototype, not own property — different structure
			expect(deepEqual(a, b)).toBe(false);
		});
	});

	describe('stripTransientKeys', () => {
		it('should remove keys prefixed with underscore', () => {
			const data = { title: 'Test', _file: Buffer.from(''), _temp: true };
			const result = stripTransientKeys(data);
			expect(result).toEqual({ title: 'Test' });
		});

		it('should keep all keys without underscore prefix', () => {
			const data = { title: 'Test', content: 'Hello', status: 'draft' };
			const result = stripTransientKeys(data);
			expect(result).toEqual({ title: 'Test', content: 'Hello', status: 'draft' });
		});

		it('should return empty object when all keys are transient', () => {
			const data = { _file: 'buffer', _temp: true, _internal: 42 };
			const result = stripTransientKeys(data);
			expect(result).toEqual({});
		});

		it('should return empty object for empty input', () => {
			expect(stripTransientKeys({})).toEqual({});
		});

		it('should not modify the original object', () => {
			const data = { title: 'Test', _file: 'buffer' };
			stripTransientKeys(data);
			expect(data).toEqual({ title: 'Test', _file: 'buffer' });
		});

		it('should preserve values of non-transient keys exactly', () => {
			const nested = { deep: [1, 2, 3] };
			const data = { config: nested, _meta: 'remove' };
			const result = stripTransientKeys(data);
			expect(result.config).toBe(nested); // same reference, not cloned
		});
	});
});

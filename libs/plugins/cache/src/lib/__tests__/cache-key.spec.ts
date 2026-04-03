import { describe, it, expect } from 'vitest';
import {
	fnv1a,
	resolveScope,
	hashQuery,
	collectionCacheKey,
	globalCacheKey,
	filterQueryParams,
	KNOWN_CMS_QUERY_PARAMS,
} from '../cache-key';

describe('fnv1a', () => {
	it('should produce a non-empty hash string', () => {
		const hash = fnv1a('hello');
		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should produce deterministic output', () => {
		expect(fnv1a('test')).toBe(fnv1a('test'));
	});

	it('should produce different hashes for different inputs', () => {
		expect(fnv1a('foo')).not.toBe(fnv1a('bar'));
	});
});

describe('resolveScope', () => {
	it('should return pub when no user', () => {
		expect(resolveScope(undefined, 'public')).toBe('pub');
		expect(resolveScope(undefined, 'role')).toBe('pub');
		expect(resolveScope(undefined, 'user')).toBe('pub');
	});

	it('should upgrade authenticated users to role-based scope for public config', () => {
		// Security: authenticated users must NOT share the public cache key.
		// Otherwise, an admin's response (with privileged fields) can be served
		// to unauthenticated users via the shared 'pub' cache key.
		expect(resolveScope({ id: '123', role: 'admin' }, 'public')).toBe('role:admin');
		expect(resolveScope({ id: '456', role: 'editor' }, 'public')).toBe('role:editor');
	});

	it('should return pub for unauthenticated users with public scope', () => {
		expect(resolveScope(undefined, 'public')).toBe('pub');
	});

	it('should return role-based scope', () => {
		expect(resolveScope({ id: '123', role: 'editor' }, 'role')).toBe('role:editor');
	});

	it('should handle missing role', () => {
		expect(resolveScope({ id: '123' }, 'role')).toBe('role:none');
	});

	it('should return user-based scope', () => {
		expect(resolveScope({ id: '456', role: 'admin' }, 'user')).toBe('usr:456');
	});
});

describe('hashQuery', () => {
	it('should return _ for empty/undefined query', () => {
		expect(hashQuery(undefined)).toBe('_');
		expect(hashQuery({})).toBe('_');
	});

	it('should produce deterministic hash for same params', () => {
		const q = { limit: 10, page: 1, sort: 'title' };
		expect(hashQuery(q)).toBe(hashQuery(q));
	});

	it('should produce same hash regardless of key order', () => {
		const q1 = { a: 1, b: 2, c: 3 };
		const q2 = { c: 3, a: 1, b: 2 };
		expect(hashQuery(q1)).toBe(hashQuery(q2));
	});

	it('should produce different hashes for different params', () => {
		expect(hashQuery({ limit: 10 })).not.toBe(hashQuery({ limit: 20 }));
	});
});

describe('collectionCacheKey', () => {
	it('should generate key for find operation', () => {
		const key = collectionCacheKey('pub', 'posts', undefined, undefined);
		expect(key).toBe('m:cache:pub:posts:find:_');
	});

	it('should generate key for findById operation', () => {
		const key = collectionCacheKey('pub', 'posts', 'abc123', undefined);
		expect(key).toContain('m:cache:pub:posts:id:abc123');
	});

	it('should include query hash', () => {
		const key = collectionCacheKey('pub', 'posts', undefined, { limit: 10 });
		expect(key).toMatch(/^m:cache:pub:posts:find:.+$/);
		expect(key.endsWith(':_')).toBe(false);
	});

	it('should include scope in key', () => {
		const pubKey = collectionCacheKey('pub', 'posts', undefined, undefined);
		const userKey = collectionCacheKey('usr:42', 'posts', undefined, undefined);
		expect(pubKey).not.toBe(userKey);
	});
});

describe('filterQueryParams', () => {
	it('should keep only known CMS query params by default', () => {
		const input = { limit: 10, page: 1, junk: 'attack', sort: 'title', evil: true };
		const result = filterQueryParams(input, KNOWN_CMS_QUERY_PARAMS);
		expect(result).toEqual({ limit: 10, page: 1, sort: 'title' });
	});

	it('should return empty object when all params are unknown', () => {
		const result = filterQueryParams({ foo: 1, bar: 2 }, KNOWN_CMS_QUERY_PARAMS);
		expect(result).toEqual({});
	});

	it('should handle undefined input', () => {
		expect(filterQueryParams(undefined, KNOWN_CMS_QUERY_PARAMS)).toBeUndefined();
	});

	it('should use custom allowlist', () => {
		const result = filterQueryParams({ limit: 10, custom: 'yes', junk: 'no' }, ['limit', 'custom']);
		expect(result).toEqual({ limit: 10, custom: 'yes' });
	});
});

describe('globalCacheKey', () => {
	it('should generate key for global', () => {
		expect(globalCacheKey('pub', 'site-settings')).toBe('m:cache:global:site-settings:pub');
	});

	it('should include scope', () => {
		expect(globalCacheKey('role:admin', 'nav')).toBe('m:cache:global:nav:role:admin');
	});
});

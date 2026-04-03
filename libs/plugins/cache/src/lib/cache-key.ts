/**
 * Cache Key Generation
 *
 * Generates deterministic cache keys from request parameters.
 * Keys include user scope to prevent cross-user cache pollution.
 */

import type { CacheScope } from './cache-plugin-config.types';

/**
 * User context subset needed for scope resolution.
 */
export interface CacheUserContext {
	id?: string | number;
	role?: string;
}

/**
 * FNV-1a 52-bit hash for fast, deterministic hashing with adequate collision resistance.
 * Uses two 32-bit FNV-1a passes with different seeds, combined into a single 52-bit value
 * (the max safe integer range for JS). Birthday-attack collisions require ~67M inputs
 * instead of ~77K with 32-bit.
 * Not cryptographic — used only for cache key generation.
 */
export function fnv1a(input: string): string {
	// First 32-bit pass (standard FNV-1a offset basis)
	let h1 = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h1 ^= input.charCodeAt(i);
		h1 = (h1 * 0x01000193) >>> 0;
	}
	// Second 32-bit pass (different offset basis for independence)
	let h2 = 0x050c5d1f;
	for (let i = 0; i < input.length; i++) {
		h2 ^= input.charCodeAt(i);
		h2 = (h2 * 0x01000193) >>> 0;
	}
	// Combine: use 20 bits from h2 + all 32 bits from h1 = 52 bits (within Number.MAX_SAFE_INTEGER)
	const combined = (h2 & 0xfffff) * 0x100000000 + h1;
	return combined.toString(36);
}

/**
 * Resolve the cache scope from user context and collection scope config.
 */
export function resolveScope(user: CacheUserContext | undefined, scopeConfig: CacheScope): string {
	if (!user) return 'pub';

	switch (scopeConfig) {
		case 'public':
			// Authenticated users are upgraded to role-based isolation to prevent
			// cross-privilege cache pollution. Only unauthenticated users share
			// the 'pub' cache key, ensuring admin-visible data never leaks.
			return `role:${user.role ?? 'none'}`;
		case 'role':
			return `role:${user.role ?? 'none'}`;
		case 'user':
			return `usr:${user.id ?? 'anon'}`;
	}
}

/**
 * Sort object keys recursively for deterministic JSON serialization.
 * Depth-limited to prevent stack overflow from deeply nested query objects.
 */
const MAX_SORT_DEPTH = 10;

function sortKeys(obj: unknown, depth = 0): unknown {
	if (depth >= MAX_SORT_DEPTH || obj === null || obj === undefined || typeof obj !== 'object')
		return obj;
	if (Array.isArray(obj)) return obj.map((item) => sortKeys(item, depth + 1));

	const record = obj as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(record).sort()) {
		sorted[key] = sortKeys(record[key], depth + 1);
	}
	return sorted;
}

/**
 * Known CMS query parameters that should be included in cache keys.
 * Any other query params are ignored to prevent cache thrashing via
 * arbitrary junk params (e.g., ?junk=1, ?junk=2, ...).
 */
export const KNOWN_CMS_QUERY_PARAMS = [
	'limit',
	'page',
	'sort',
	'depth',
	'where',
	'withDeleted',
	'onlyDeleted',
	'locale',
	'fallbackLocale',
	'draft',
];

/**
 * Filter query parameters to only include allowed params.
 * Returns undefined if input is undefined, empty object if no params match.
 */
export function filterQueryParams(
	query: Record<string, unknown> | undefined,
	allowedParams: string[],
): Record<string, unknown> | undefined {
	if (!query) return undefined;
	const allowedSet = new Set(allowedParams);
	const filtered: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(query)) {
		if (allowedSet.has(k)) filtered[k] = v;
	}
	return filtered;
}

/**
 * Hash query parameters into a deterministic short string.
 */
export function hashQuery(query: Record<string, unknown> | undefined): string {
	if (!query || Object.keys(query).length === 0) return '_';
	const sorted = sortKeys(query);
	return fnv1a(JSON.stringify(sorted));
}

/**
 * Generate a cache key for a collection request.
 */
export function collectionCacheKey(
	scope: string,
	collection: string,
	id: string | undefined,
	query: Record<string, unknown> | undefined,
): string {
	const operation = id ? `id:${id}` : 'find';
	return `m:cache:${scope}:${collection}:${operation}:${hashQuery(query)}`;
}

/**
 * Generate a cache key for a global request.
 */
export function globalCacheKey(scope: string, slug: string): string {
	return `m:cache:global:${slug}:${scope}`;
}

/**
 * Allow/deny list filtering for collections and globals exposed via MCP.
 */

import type { CollectionConfig, GlobalConfig } from '@momentumcms/core';

/** Prefixes that identify internal/auth collections, always excluded from MCP. */
const AUTH_SLUG_PREFIXES = ['auth-'];

/**
 * Creates a filter function that checks whether a collection slug is accessible via MCP.
 *
 * Rules:
 * 1. Auth collections (slugs starting with "auth-") are always excluded.
 * 2. If `allowedCollections` is non-empty, the slug must be in that list.
 * 3. The slug must not be in `deniedCollections`.
 * 4. The slug must correspond to a known collection.
 */
export function createCollectionFilter(
	collections: CollectionConfig[],
	allowedCollections: string[],
	deniedCollections: string[],
): (slug: string) => boolean {
	const knownSlugs = new Set(collections.map((c) => c.slug));
	const allowSet = new Set(allowedCollections);
	const denySet = new Set(deniedCollections);

	return (slug: string): boolean => {
		if (!knownSlugs.has(slug)) return false;
		if (AUTH_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) return false;
		if (denySet.has(slug)) return false;
		if (allowSet.size > 0 && !allowSet.has(slug)) return false;
		return true;
	};
}

/**
 * Creates a filter function that checks whether a global slug is accessible via MCP.
 *
 * Rules:
 * 1. If `allowedGlobals` is non-empty, the slug must be in that list.
 * 2. The slug must not be in `deniedGlobals`.
 * 3. The slug must correspond to a known global.
 */
export function createGlobalFilter(
	globals: GlobalConfig[],
	allowedGlobals: string[],
	deniedGlobals: string[],
): (slug: string) => boolean {
	const knownSlugs = new Set(globals.map((g) => g.slug));
	const allowSet = new Set(allowedGlobals);
	const denySet = new Set(deniedGlobals);

	return (slug: string): boolean => {
		if (!knownSlugs.has(slug)) return false;
		if (denySet.has(slug)) return false;
		if (allowSet.size > 0 && !allowSet.has(slug)) return false;
		return true;
	};
}

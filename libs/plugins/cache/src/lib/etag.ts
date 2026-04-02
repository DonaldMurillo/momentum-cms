/**
 * ETag Utilities
 *
 * Generates weak ETags from response bodies and handles If-None-Match matching.
 */

import { fnv1a } from './cache-key';

/**
 * Generate a weak ETag from a response body.
 * Uses FNV-1a hash of the JSON-serialized body.
 */
export function generateEtag(body: unknown): string {
	const json = typeof body === 'string' ? body : JSON.stringify(body);
	return `W/"${fnv1a(json)}"`;
}

/**
 * Check if an If-None-Match header value matches a given ETag.
 * Supports comma-separated lists and wildcard (*).
 */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
	if (!ifNoneMatch) return false;

	const trimmed = ifNoneMatch.trim();
	if (trimmed === '*') return true;

	// Split by comma, trim each, compare
	const tags = trimmed.split(',').map((t) => t.trim());
	return tags.includes(etag);
}

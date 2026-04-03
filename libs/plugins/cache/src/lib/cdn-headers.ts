/**
 * CDN Header Builders
 *
 * Generates Cache-Control, Surrogate-Control, and Vary headers
 * based on collection cache config and request scope.
 */

import type { CollectionCacheConfig, CdnConfig } from './cache-plugin-config.types';

export interface CacheHeaders {
	'Cache-Control': string;
	Vary: string;
	'Surrogate-Control'?: string;
	'Surrogate-Key'?: string;
}

/**
 * Build HTTP cache headers for a cached response.
 */
export function buildCacheHeaders(
	scope: string,
	ttl: number,
	collectionConfig: CollectionCacheConfig | undefined,
	cdnEnabled: boolean | CdnConfig | undefined,
): CacheHeaders {
	const isPublic = scope === 'pub';
	const varyParts = ['Accept'];

	// Add user-specified Vary headers
	if (collectionConfig?.varyHeaders) {
		varyParts.push(...collectionConfig.varyHeaders);
	}

	// Non-public responses must vary by Authorization
	if (!isPublic) {
		varyParts.push('Authorization');
	}

	const headers: CacheHeaders = {
		'Cache-Control': isPublic ? `public, max-age=${ttl}` : `private, max-age=${ttl}`,
		Vary: [...new Set(varyParts)].join(', '),
	};

	// CDN headers (only for public scope)
	if (isPublic && cdnEnabled) {
		const cdnConfig: CdnConfig = typeof cdnEnabled === 'object' ? cdnEnabled : {};
		const collCdn = collectionConfig?.cdn;

		const cdnMaxAge = collCdn?.maxAge ?? cdnConfig.maxAge ?? ttl;
		const swr = collCdn?.staleWhileRevalidate ?? cdnConfig.staleWhileRevalidate;

		let surrogateControl = `max-age=${cdnMaxAge}`;
		if (swr) {
			surrogateControl += `, stale-while-revalidate=${swr}`;
		}
		headers['Surrogate-Control'] = surrogateControl;

		if (collCdn?.surrogateKeys?.length) {
			headers['Surrogate-Key'] = collCdn.surrogateKeys.join(' ');
		}
	}

	return headers;
}

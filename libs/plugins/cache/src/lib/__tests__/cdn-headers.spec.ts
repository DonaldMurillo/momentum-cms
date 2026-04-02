import { describe, it, expect } from 'vitest';
import { buildCacheHeaders } from '../cdn-headers';

describe('buildCacheHeaders', () => {
	it('should set public Cache-Control for public scope', () => {
		const headers = buildCacheHeaders('pub', 60, undefined, false);
		expect(headers['Cache-Control']).toBe('public, max-age=60');
	});

	it('should set private Cache-Control for user scope', () => {
		const headers = buildCacheHeaders('usr:42', 120, undefined, false);
		expect(headers['Cache-Control']).toBe('private, max-age=120');
	});

	it('should set private Cache-Control for role scope', () => {
		const headers = buildCacheHeaders('role:editor', 30, undefined, false);
		expect(headers['Cache-Control']).toBe('private, max-age=30');
	});

	it('should include Authorization in Vary for non-public', () => {
		const headers = buildCacheHeaders('usr:42', 60, undefined, false);
		expect(headers.Vary).toContain('Authorization');
	});

	it('should not include Authorization in Vary for public', () => {
		const headers = buildCacheHeaders('pub', 60, undefined, false);
		expect(headers.Vary).not.toContain('Authorization');
	});

	it('should always include Accept in Vary', () => {
		const headers = buildCacheHeaders('pub', 60, undefined, false);
		expect(headers.Vary).toContain('Accept');
	});

	it('should include custom Vary headers', () => {
		const headers = buildCacheHeaders('pub', 60, { varyHeaders: ['Accept-Language'] }, false);
		expect(headers.Vary).toContain('Accept-Language');
	});

	it('should deduplicate Vary headers', () => {
		const headers = buildCacheHeaders('pub', 60, { varyHeaders: ['Accept'] }, false);
		const parts = headers.Vary.split(', ');
		expect(parts.filter((p) => p === 'Accept')).toHaveLength(1);
	});

	it('should add Surrogate-Control for CDN-enabled public responses', () => {
		const headers = buildCacheHeaders('pub', 60, undefined, { maxAge: 300 });
		expect(headers['Surrogate-Control']).toBe('max-age=300');
	});

	it('should add stale-while-revalidate to Surrogate-Control', () => {
		const headers = buildCacheHeaders('pub', 60, undefined, {
			maxAge: 300,
			staleWhileRevalidate: 60,
		});
		expect(headers['Surrogate-Control']).toBe('max-age=300, stale-while-revalidate=60');
	});

	it('should not add CDN headers for non-public scope', () => {
		const headers = buildCacheHeaders('usr:42', 60, undefined, { maxAge: 300 });
		expect(headers['Surrogate-Control']).toBeUndefined();
	});

	it('should use collection CDN config over global CDN config', () => {
		const headers = buildCacheHeaders(
			'pub',
			60,
			{ cdn: { maxAge: 600, surrogateKeys: ['posts', 'featured'] } },
			{ maxAge: 300 },
		);
		expect(headers['Surrogate-Control']).toBe('max-age=600');
		expect(headers['Surrogate-Key']).toBe('posts featured');
	});

	it('should use TTL as CDN max-age fallback', () => {
		const headers = buildCacheHeaders('pub', 90, undefined, true);
		expect(headers['Surrogate-Control']).toBe('max-age=90');
	});
});

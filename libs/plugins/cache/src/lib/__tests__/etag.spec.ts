import { describe, it, expect } from 'vitest';
import { generateEtag, matchesEtag } from '../etag';

describe('generateEtag', () => {
	it('should generate a weak ETag', () => {
		const etag = generateEtag({ docs: [{ id: '1' }] });
		expect(etag).toMatch(/^W\/"[a-z0-9]+"/);
	});

	it('should be deterministic', () => {
		const data = { foo: 'bar', num: 42 };
		expect(generateEtag(data)).toBe(generateEtag(data));
	});

	it('should produce different ETags for different bodies', () => {
		expect(generateEtag({ a: 1 })).not.toBe(generateEtag({ a: 2 }));
	});

	it('should handle string input', () => {
		const etag = generateEtag('plain text');
		expect(etag).toMatch(/^W\/"[a-z0-9]+"/);
	});
});

describe('matchesEtag', () => {
	it('should return false for undefined header', () => {
		expect(matchesEtag(undefined, 'W/"abc"')).toBe(false);
	});

	it('should match exact ETag', () => {
		expect(matchesEtag('W/"abc"', 'W/"abc"')).toBe(true);
	});

	it('should not match different ETag', () => {
		expect(matchesEtag('W/"abc"', 'W/"xyz"')).toBe(false);
	});

	it('should match wildcard', () => {
		expect(matchesEtag('*', 'W/"anything"')).toBe(true);
	});

	it('should match in comma-separated list', () => {
		expect(matchesEtag('W/"aaa", W/"bbb", W/"ccc"', 'W/"bbb"')).toBe(true);
	});

	it('should not match in comma-separated list when absent', () => {
		expect(matchesEtag('W/"aaa", W/"bbb"', 'W/"zzz"')).toBe(false);
	});

	it('should handle whitespace', () => {
		expect(matchesEtag('  W/"abc"  ', 'W/"abc"')).toBe(true);
	});
});

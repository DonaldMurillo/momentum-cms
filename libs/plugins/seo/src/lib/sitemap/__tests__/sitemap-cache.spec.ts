import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SitemapCache } from '../sitemap-cache';

describe('SitemapCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return null for missing key', () => {
		const cache = new SitemapCache();
		expect(cache.get('missing')).toBeNull();
	});

	it('should store and retrieve a value', () => {
		const cache = new SitemapCache();
		cache.set('sitemap', '<xml>test</xml>');
		expect(cache.get('sitemap')).toBe('<xml>test</xml>');
	});

	it('should return null after TTL expires', () => {
		const cache = new SitemapCache(1000);
		cache.set('sitemap', '<xml>data</xml>');

		vi.advanceTimersByTime(500);
		expect(cache.get('sitemap')).toBe('<xml>data</xml>');

		vi.advanceTimersByTime(600);
		expect(cache.get('sitemap')).toBeNull();
	});

	it('should respect custom TTL per entry', () => {
		const cache = new SitemapCache(10_000);
		cache.set('fast', '<xml>fast</xml>', 500);

		vi.advanceTimersByTime(600);
		expect(cache.get('fast')).toBeNull();
	});

	it('should invalidate a specific key', () => {
		const cache = new SitemapCache();
		cache.set('sitemap', '<xml>test</xml>');
		cache.invalidate('sitemap');
		expect(cache.get('sitemap')).toBeNull();
	});

	it('should clear all entries', () => {
		const cache = new SitemapCache();
		cache.set('a', 'one');
		cache.set('b', 'two');
		cache.clear();
		expect(cache.get('a')).toBeNull();
		expect(cache.get('b')).toBeNull();
	});

	it('should use default TTL of 300s', () => {
		const cache = new SitemapCache();
		cache.set('sitemap', '<xml>test</xml>');

		vi.advanceTimersByTime(299_000);
		expect(cache.get('sitemap')).toBe('<xml>test</xml>');

		vi.advanceTimersByTime(2_000);
		expect(cache.get('sitemap')).toBeNull();
	});

	it('should overwrite existing entry on set', () => {
		const cache = new SitemapCache();
		cache.set('key', 'first');
		cache.set('key', 'second');
		expect(cache.get('key')).toBe('second');
	});
});

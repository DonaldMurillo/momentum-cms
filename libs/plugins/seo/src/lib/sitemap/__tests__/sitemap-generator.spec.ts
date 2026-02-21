import { describe, it, expect } from 'vitest';
import { generateSitemap, generateSitemapIndex } from '../sitemap-generator';
import type { SitemapEntry } from '../sitemap-generator';

describe('generateSitemap', () => {
	it('should generate valid XML sitemap with urlset root element', () => {
		const entries: SitemapEntry[] = [{ loc: 'https://example.com/' }];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain('</urlset>');
	});

	it('should include loc for each entry', () => {
		const entries: SitemapEntry[] = [
			{ loc: 'https://example.com/' },
			{ loc: 'https://example.com/about' },
		];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<loc>https://example.com/</loc>');
		expect(xml).toContain('<loc>https://example.com/about</loc>');
	});

	it('should include lastmod when provided', () => {
		const entries: SitemapEntry[] = [{ loc: 'https://example.com/', lastmod: '2024-01-01' }];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<lastmod>2024-01-01</lastmod>');
	});

	it('should include changefreq when provided', () => {
		const entries: SitemapEntry[] = [{ loc: 'https://example.com/', changefreq: 'weekly' }];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<changefreq>weekly</changefreq>');
	});

	it('should include priority when provided', () => {
		const entries: SitemapEntry[] = [{ loc: 'https://example.com/', priority: 0.8 }];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<priority>0.8</priority>');
	});

	it('should escape XML special characters in URLs', () => {
		const entries: SitemapEntry[] = [{ loc: 'https://example.com/?a=1&b=2' }];
		const xml = generateSitemap(entries);
		expect(xml).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>');
		expect(xml).not.toContain('&b=2</loc>');
	});

	it('should handle empty entries array', () => {
		const xml = generateSitemap([]);
		expect(xml).toContain('<urlset');
		expect(xml).toContain('</urlset>');
		expect(xml).not.toContain('<url>');
	});

	it('should escape XML special characters in changefreq', () => {
		const entries: SitemapEntry[] = [
			{
				loc: 'https://example.com/',
				changefreq: '</changefreq><priority>0.1</priority><changefreq>' as never,
			},
		];
		const xml = generateSitemap(entries);
		expect(xml).not.toContain('</changefreq><priority>0.1</priority>');
		expect(xml).toContain('&lt;/changefreq&gt;');
	});
});

describe('generateSitemapIndex', () => {
	it('should generate valid sitemap index', () => {
		const urls = ['https://example.com/sitemap-1.xml'];
		const xml = generateSitemapIndex(urls);
		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain('</sitemapindex>');
	});

	it('should include loc for each sitemap URL', () => {
		const urls = ['https://example.com/sitemap-1.xml', 'https://example.com/sitemap-2.xml'];
		const xml = generateSitemapIndex(urls);
		expect(xml).toContain('<loc>https://example.com/sitemap-1.xml</loc>');
		expect(xml).toContain('<loc>https://example.com/sitemap-2.xml</loc>');
	});

	it('should escape XML special characters', () => {
		const urls = ['https://example.com/sitemap.xml?type=a&page=1'];
		const xml = generateSitemapIndex(urls);
		expect(xml).toContain('&amp;page=1');
	});

	it('should handle empty array', () => {
		const xml = generateSitemapIndex([]);
		expect(xml).toContain('<sitemapindex');
		expect(xml).toContain('</sitemapindex>');
		expect(xml).not.toContain('<sitemap>');
	});
});

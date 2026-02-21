/**
 * Sitemap XML Generator
 *
 * Pure functions that build XML sitemap and sitemap index strings.
 */

import type { SitemapChangeFreq } from '../seo-config.types';

export interface SitemapEntry {
	loc: string;
	lastmod?: string;
	changefreq?: SitemapChangeFreq;
	priority?: number;
}

/**
 * Escape XML special characters in a string.
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Generate an XML sitemap from a list of URL entries.
 */
export function generateSitemap(entries: SitemapEntry[]): string {
	const urls = entries
		.map((entry) => {
			const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
			if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
			if (entry.changefreq)
				parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
			if (entry.priority != null)
				parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
			return `  <url>\n${parts.join('\n')}\n  </url>`;
		})
		.join('\n');

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		urls,
		'</urlset>',
	].join('\n');
}

/**
 * Generate a sitemap index pointing to multiple sitemap files.
 */
export function generateSitemapIndex(sitemapUrls: string[]): string {
	const sitemaps = sitemapUrls
		.map((url) => `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n  </sitemap>`)
		.join('\n');

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		sitemaps,
		'</sitemapindex>',
	].join('\n');
}

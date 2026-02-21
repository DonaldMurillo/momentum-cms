/**
 * Robots.txt Generator (browser-safe)
 *
 * Pure function to generate robots.txt content from configuration.
 * Separated from robots-handler.ts to avoid pulling Express into
 * the browser bundle (admin pages import this for the live preview).
 */

import type { RobotsConfig } from '../seo-config.types';

/**
 * Strip newline characters to prevent directive injection.
 */
function sanitizeLine(str: string): string {
	return str.replace(/[\r\n]/g, '');
}

/**
 * Generate robots.txt content from configuration.
 */
export function generateRobotsTxt(siteUrl: string, config: RobotsConfig): string {
	const lines: string[] = [];

	if (config.rules && config.rules.length > 0) {
		for (const rule of config.rules) {
			lines.push(`User-agent: ${sanitizeLine(rule.userAgent)}`);
			if (rule.allow) {
				for (const path of rule.allow) {
					lines.push(`Allow: ${sanitizeLine(path)}`);
				}
			}
			if (rule.disallow) {
				for (const path of rule.disallow) {
					lines.push(`Disallow: ${sanitizeLine(path)}`);
				}
			}
			if (config.crawlDelay != null) {
				lines.push(`Crawl-delay: ${config.crawlDelay}`);
			}
			lines.push('');
		}
	} else {
		lines.push('User-agent: *');
		lines.push('Allow: /');
		if (config.crawlDelay != null) {
			lines.push(`Crawl-delay: ${config.crawlDelay}`);
		}
		lines.push('');
	}

	// Include sitemap URL only when siteUrl is an absolute URL (per sitemaps.org spec)
	if (siteUrl) {
		lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
	}

	if (config.additionalSitemaps) {
		for (const sitemap of config.additionalSitemaps) {
			lines.push(`Sitemap: ${sanitizeLine(sitemap)}`);
		}
	}

	return lines.join('\n');
}

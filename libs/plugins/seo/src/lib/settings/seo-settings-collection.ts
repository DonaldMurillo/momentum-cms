/**
 * SEO Settings Collection (Singleton)
 *
 * Stores site-wide SEO configuration: robots.txt rules, crawl delay,
 * additional sitemaps, and future global SEO settings.
 * One document per site (upsert by querying for the singleton).
 * Hidden from sidebar — managed via the Robots Settings admin page.
 */

import { defineCollection, json, number, hasRole } from '@momentumcms/core';
import type { AccessArgs } from '@momentumcms/core';

/**
 * Allow internal server-side calls (no user context) or admin users.
 */
function internalOrAdmin({ req }: AccessArgs): boolean {
	if (!req.user) return true;
	return req.user.role === 'admin';
}

export const SeoSettings = defineCollection({
	slug: 'seo-settings',
	managed: true,
	labels: { singular: 'SEO Setting', plural: 'SEO Settings' },
	admin: {
		group: 'SEO',
		hidden: true,
	},
	fields: [
		json('robotsRules', {
			label: 'Robots Rules',
			description: 'Array of { userAgent, allow, disallow } rules',
		}),
		number('robotsCrawlDelay', {
			label: 'Crawl Delay',
			min: 0,
			description: 'Crawl delay in seconds (optional)',
		}),
		json('robotsAdditionalSitemaps', {
			label: 'Additional Sitemaps',
			description: 'Array of additional sitemap URLs to include',
		}),
	],
	access: {
		read: internalOrAdmin,
		create: internalOrAdmin,
		update: internalOrAdmin,
		delete: hasRole('admin'),
	},
});

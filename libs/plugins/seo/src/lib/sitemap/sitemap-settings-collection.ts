/**
 * SEO Sitemap Settings Collection
 *
 * Stores per-collection sitemap configuration (include/exclude, priority, change frequency).
 * Hidden from sidebar — managed via the Sitemap Settings admin page.
 */

import { defineCollection, text, number, select, checkbox, hasRole } from '@momentumcms/core';
import type { AccessArgs } from '@momentumcms/core';

/**
 * Allow internal server-side calls (no user context) or admin users.
 * Plugin hooks and the sitemap handler run without user context.
 *
 * Safe because the collection is `managed: true` — no auto-generated
 * REST routes exist. The admin page uses a custom endpoint with
 * its own admin auth guard.
 */
function internalOrAdmin({ req }: AccessArgs): boolean {
	if (!req.user) return true;
	return req.user.role === 'admin';
}

export const SeoSitemapSettings = defineCollection({
	slug: 'seo-sitemap-settings',
	managed: true,
	labels: { singular: 'Sitemap Setting', plural: 'Sitemap Settings' },
	admin: {
		group: 'SEO',
		hidden: true,
		useAsTitle: 'collection',
	},
	fields: [
		text('collection', { required: true, label: 'Collection Slug' }),
		checkbox('includeInSitemap', {
			label: 'Include in Sitemap',
			defaultValue: true,
		}),
		number('priority', {
			label: 'Priority',
			min: 0,
			max: 1,
			description: 'Sitemap priority (0.0 to 1.0)',
		}),
		select('changeFreq', {
			label: 'Change Frequency',
			options: [
				{ label: 'Always', value: 'always' },
				{ label: 'Hourly', value: 'hourly' },
				{ label: 'Daily', value: 'daily' },
				{ label: 'Weekly', value: 'weekly' },
				{ label: 'Monthly', value: 'monthly' },
				{ label: 'Yearly', value: 'yearly' },
				{ label: 'Never', value: 'never' },
			],
			defaultValue: 'weekly',
		}),
	],
	access: {
		read: internalOrAdmin,
		create: internalOrAdmin,
		update: internalOrAdmin,
		delete: hasRole('admin'),
	},
});

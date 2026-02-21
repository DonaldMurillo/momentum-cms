/**
 * SEO Field Definitions
 *
 * Browser-safe — no server-side imports.
 * Creates the SEO fields that get injected into collections,
 * either as a group field or as a named tab config.
 */

import type { Field, GroupField, TabConfig } from '@momentumcms/core';
import { group, text, textarea, checkbox, select, json, upload } from '@momentumcms/core';

/**
 * Return the raw SEO fields shared by both group and tab config.
 */
export function getSeoFields(): Field[] {
	return [
		text('metaTitle', {
			label: 'Meta Title',
			maxLength: 70,
			description: 'Title tag for search engines (50-60 chars recommended)',
		}),
		textarea('metaDescription', {
			label: 'Meta Description',
			maxLength: 160,
			rows: 3,
			description: 'Description for search results (120-155 chars recommended)',
		}),
		text('canonicalUrl', {
			label: 'Canonical URL',
			description: 'Override the canonical URL for this page',
		}),
		text('focusKeyword', {
			label: 'Focus Keyword',
			description: 'Primary keyword to optimize this content for',
		}),
		text('ogTitle', {
			label: 'OG Title',
			description: 'Open Graph title (falls back to Meta Title)',
		}),
		textarea('ogDescription', {
			label: 'OG Description',
			rows: 2,
			description: 'Open Graph description (falls back to Meta Description)',
		}),
		upload('ogImage', {
			label: 'OG Image',
			relationTo: 'media',
			mimeTypes: ['image/*'],
			description: 'Recommended size: 1200x630px',
		}),
		select('ogType', {
			label: 'OG Type',
			options: [
				{ label: 'Website', value: 'website' },
				{ label: 'Article', value: 'article' },
				{ label: 'Product', value: 'product' },
				{ label: 'Profile', value: 'profile' },
			],
			defaultValue: 'website',
		}),
		select('twitterCard', {
			label: 'Twitter Card',
			options: [
				{ label: 'Summary', value: 'summary' },
				{ label: 'Summary Large Image', value: 'summary_large_image' },
				{ label: 'Player', value: 'player' },
				{ label: 'App', value: 'app' },
			],
			defaultValue: 'summary_large_image',
		}),
		checkbox('noIndex', {
			label: 'No Index',
			description: 'Tell search engines not to index this page',
		}),
		checkbox('noFollow', {
			label: 'No Follow',
			description: 'Tell search engines not to follow links on this page',
		}),
		checkbox('excludeFromSitemap', {
			label: 'Exclude from Sitemap',
			description:
				'Exclude this page from the XML sitemap without affecting search engine indexing',
		}),
		json('structuredData', {
			label: 'Structured Data (JSON-LD)',
			description: 'Custom JSON-LD structured data for this page',
		}),
	];
}

/**
 * Create the `seo` group field injected into collections.
 */
export function createSeoGroupField(): GroupField {
	return group('seo', {
		label: 'SEO',
		admin: { collapsible: true, defaultOpen: false },
		fields: getSeoFields(),
	});
}

/**
 * Create a named tab config for SEO fields.
 * Named tabs store data under `doc.seo.*` — same shape as `group('seo', ...)`.
 */
export function createSeoTabConfig(): TabConfig {
	return {
		name: 'seo',
		label: 'SEO',
		description: 'Search engine optimization settings',
		fields: getSeoFields(),
	};
}

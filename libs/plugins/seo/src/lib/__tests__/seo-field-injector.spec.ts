import { describe, it, expect } from 'vitest';
import { injectSeoFields } from '../seo-field-injector';
import type { CollectionConfig, Field, TabsField } from '@momentumcms/core';
import { tabs, text } from '@momentumcms/core';

function makeCollection(
	slug: string,
	fields: Field[] = [],
	overrides?: Partial<CollectionConfig>,
): CollectionConfig {
	return { slug, fields, ...overrides } as CollectionConfig;
}

/** Extract the TabsField from a collection (expects exactly one top-level tabs field). */
function getTabsField(collection: CollectionConfig): TabsField {
	const tf = collection.fields.find((f) => f.type === 'tabs') as TabsField | undefined;
	if (!tf) throw new Error('No tabs field found');
	return tf;
}

describe('injectSeoFields', () => {
	it('should wrap fields in a tabs layout with Content + SEO tabs', () => {
		const collections = [makeCollection('posts', [text('title', { required: true })])];

		injectSeoFields(collections, { collections: ['posts'] });

		expect(collections[0].fields).toHaveLength(1);
		const tf = getTabsField(collections[0]);
		expect(tf.tabs).toHaveLength(2);
		expect(tf.tabs[0].label).toBe('Content');
		expect(tf.tabs[0].name).toBeUndefined();
		expect(tf.tabs[0].fields).toHaveLength(1);
		expect(tf.tabs[0].fields[0].name).toBe('title');
		expect(tf.tabs[1].label).toBe('SEO');
		expect(tf.tabs[1].name).toBe('seo');
	});

	it('should inject into multiple targeted collections', () => {
		const collections = [
			makeCollection('posts', [text('title')]),
			makeCollection('pages', [text('slug')]),
		];

		injectSeoFields(collections, { collections: ['posts', 'pages'] });

		for (const col of collections) {
			const tf = getTabsField(col);
			expect(tf.tabs.some((t) => t.name === 'seo')).toBe(true);
		}
	});

	it('should be idempotent — calling twice does not duplicate SEO tab', () => {
		const collections = [makeCollection('posts', [text('title')])];

		injectSeoFields(collections, { collections: ['posts'] });
		injectSeoFields(collections, { collections: ['posts'] });

		const tf = getTabsField(collections[0]);
		const seoTabs = tf.tabs.filter((t) => t.name === 'seo');
		expect(seoTabs).toHaveLength(1);
	});

	it('should skip managed collections', () => {
		const collections = [makeCollection('external', [], { managed: true })];

		injectSeoFields(collections, { collections: ['external'] });

		expect(collections[0].fields).toHaveLength(0);
	});

	it('should skip seo-* prefixed collections', () => {
		const collections = [makeCollection('seo-analysis')];

		injectSeoFields(collections, { collections: ['seo-analysis'] });

		expect(collections[0].fields).toHaveLength(0);
	});

	it('should handle wildcard * mode', () => {
		const collections = [
			makeCollection('posts', [text('title')]),
			makeCollection('pages', [text('slug')]),
		];

		injectSeoFields(collections, { collections: '*' });

		for (const col of collections) {
			const tf = getTabsField(col);
			expect(tf.tabs.some((t) => t.name === 'seo')).toBe(true);
		}
	});

	it('should respect excludeCollections in wildcard mode', () => {
		const collections = [
			makeCollection('posts', [text('title')]),
			makeCollection('settings', [text('siteName')]),
		];

		injectSeoFields(collections, { collections: '*', excludeCollections: ['settings'] });

		const postsTf = getTabsField(collections[0]);
		expect(postsTf.tabs.some((t) => t.name === 'seo')).toBe(true);
		expect(collections[1].fields[0].type).toBe('text'); // unchanged
	});

	it('should handle empty collections array', () => {
		const collections: CollectionConfig[] = [];
		injectSeoFields(collections, { collections: ['posts'] });
		expect(collections).toHaveLength(0);
	});

	it('should handle collections with no matching slugs', () => {
		const collections = [makeCollection('products', [text('name')])];

		injectSeoFields(collections, { collections: ['posts'] });

		expect(collections[0].fields).toHaveLength(1);
		expect(collections[0].fields[0].name).toBe('name');
	});

	it('should include all expected SEO fields in the seo tab', () => {
		const collections = [makeCollection('posts', [text('title')])];

		injectSeoFields(collections, { collections: ['posts'] });

		const tf = getTabsField(collections[0]);
		const seoTab = tf.tabs.find((t) => t.name === 'seo')!;
		const fieldNames = seoTab.fields.map((f) => f.name);

		expect(fieldNames).toContain('metaTitle');
		expect(fieldNames).toContain('metaDescription');
		expect(fieldNames).toContain('canonicalUrl');
		expect(fieldNames).toContain('focusKeyword');
		expect(fieldNames).toContain('ogTitle');
		expect(fieldNames).toContain('ogDescription');
		expect(fieldNames).toContain('ogImage');
		expect(fieldNames).toContain('ogType');
		expect(fieldNames).toContain('twitterCard');
		expect(fieldNames).toContain('noIndex');
		expect(fieldNames).toContain('noFollow');
		expect(fieldNames).toContain('excludeFromSitemap');
		expect(fieldNames).toContain('structuredData');
	});

	it('should not inject into collections not in the target list', () => {
		const collections = [
			makeCollection('posts', [text('title')]),
			makeCollection('products', [text('name')]),
		];

		injectSeoFields(collections, { collections: ['posts'] });

		const postsTf = getTabsField(collections[0]);
		expect(postsTf.tabs.some((t) => t.name === 'seo')).toBe(true);
		expect(collections[1].fields[0].name).toBe('name');
	});

	it('should skip managed collections even in wildcard mode', () => {
		const collections = [
			makeCollection('posts', [text('title')]),
			makeCollection('auth-users', [], { managed: true }),
		];

		injectSeoFields(collections, { collections: '*' });

		const postsTf = getTabsField(collections[0]);
		expect(postsTf.tabs.some((t) => t.name === 'seo')).toBe(true);
		expect(collections[1].fields).toHaveLength(0);
	});

	describe('collections with existing top-level tabs', () => {
		it('should append SEO tab to existing tabs field', () => {
			const existingTabs = tabs('settingsTabs', {
				tabs: [
					{ label: 'General', fields: [text('siteName')] },
					{ label: 'Social', fields: [text('twitterHandle')] },
				],
			});
			const collections = [makeCollection('posts', [existingTabs])];

			injectSeoFields(collections, { collections: ['posts'] });

			// Should still have one tabs field, not two
			expect(collections[0].fields).toHaveLength(1);
			const tf = getTabsField(collections[0]);
			expect(tf.tabs).toHaveLength(3);
			expect(tf.tabs[0].label).toBe('General');
			expect(tf.tabs[1].label).toBe('Social');
			expect(tf.tabs[2].label).toBe('SEO');
			expect(tf.tabs[2].name).toBe('seo');
		});

		it('should be idempotent when collection already has tabs', () => {
			const existingTabs = tabs('settingsTabs', {
				tabs: [{ label: 'General', fields: [text('siteName')] }],
			});
			const collections = [makeCollection('posts', [existingTabs])];

			injectSeoFields(collections, { collections: ['posts'] });
			injectSeoFields(collections, { collections: ['posts'] });

			const tf = getTabsField(collections[0]);
			const seoTabs = tf.tabs.filter((t) => t.name === 'seo');
			expect(seoTabs).toHaveLength(1);
		});
	});

	describe('collections with empty fields', () => {
		it('should wrap empty content in a tabs layout', () => {
			const collections = [makeCollection('posts')];

			injectSeoFields(collections, { collections: ['posts'] });

			const tf = getTabsField(collections[0]);
			expect(tf.tabs).toHaveLength(2);
			expect(tf.tabs[0].label).toBe('Content');
			expect(tf.tabs[0].fields).toHaveLength(0);
			expect(tf.tabs[1].name).toBe('seo');
		});
	});
});

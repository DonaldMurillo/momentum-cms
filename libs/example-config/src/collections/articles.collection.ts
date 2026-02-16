import { defineCollection, text, richText, relationship, allowAll } from '@momentumcms/core';
import { Categories } from './categories.collection';

/**
 * Collection with relationship for seeding E2E tests.
 * Tests dependency resolution via getSeeded().
 * Also tests versioning functionality.
 */
export const Articles = defineCollection({
	slug: 'articles',
	labels: {
		singular: 'Article',
		plural: 'Articles',
	},
	admin: { group: 'Content' },
	fields: [
		text('title', { required: true, label: 'Title' }),
		richText('content', { label: 'Content' }),
		relationship('category', {
			label: 'Category',
			collection: () => Categories,
		}),
	],
	// Enable versioning with drafts for E2E testing
	versions: {
		drafts: true,
		maxPerDoc: 10,
	},
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
		// Version access controls - allow all for testing
		readVersions: allowAll(),
		publishVersions: allowAll(),
		restoreVersions: allowAll(),
	},
});

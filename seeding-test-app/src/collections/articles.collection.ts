import { defineCollection, text, textarea, relationship, allowAll } from '@momentum-cms/core';
import { Categories } from './categories.collection';

/**
 * Collection with relationship for seeding E2E tests.
 * Tests dependency resolution via getSeeded().
 */
export const Articles = defineCollection({
	slug: 'articles',
	labels: {
		singular: 'Article',
		plural: 'Articles',
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		textarea('content', { label: 'Content' }),
		relationship('category', {
			label: 'Category',
			collection: () => Categories,
		}),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
});

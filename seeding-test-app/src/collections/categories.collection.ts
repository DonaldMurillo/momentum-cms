import { defineCollection, text, allowAll } from '@momentum-cms/core';

/**
 * Simple collection for seeding E2E tests.
 * Used to test basic seeding and relationships.
 */
export const Categories = defineCollection({
	slug: 'categories',
	labels: {
		singular: 'Category',
		plural: 'Categories',
	},
	fields: [
		text('name', { required: true, label: 'Name' }),
		text('slug', { required: true, label: 'Slug' }),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
});

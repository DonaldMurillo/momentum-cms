import { defineCollection, text, relationship, allowAll } from '@momentumcms/core';
import { Categories } from './categories.collection';

/**
 * Tags collection for testing required relationship + FK restrict behavior.
 * The `category` field is required, so ON DELETE SET NULL is impossible.
 * The DB adapter automatically uses ON DELETE RESTRICT for required relationships.
 */
export const Tags = defineCollection({
	slug: 'tags',
	labels: {
		singular: 'Tag',
		plural: 'Tags',
	},
	fields: [
		text('name', { required: true, label: 'Name' }),
		relationship('category', {
			label: 'Category',
			collection: () => Categories,
			required: true,
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

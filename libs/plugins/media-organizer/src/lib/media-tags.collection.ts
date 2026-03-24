import { defineCollection, text } from '@momentumcms/core';

/**
 * Media Tags collection for tagging media assets.
 */
export const MediaTagsCollection = defineCollection({
	slug: 'media-tags',
	labels: {
		singular: 'Media Tag',
		plural: 'Media Tags',
	},
	admin: {
		useAsTitle: 'name',
		group: 'Media',
		hidden: true,
	},
	fields: [
		text('name', { required: true, label: 'Tag Name' }),
		text('color', { label: 'Color', description: 'Hex color for visual distinction' }),
	],
	indexes: [{ columns: ['name'], unique: true }],
	access: {
		read: () => true,
		create: ({ req }) => !!req?.user,
		update: ({ req }) => !!req?.user,
		delete: ({ req }) => !!req?.user,
	},
});

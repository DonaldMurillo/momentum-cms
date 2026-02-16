import { defineCollection, text, richText } from '@momentum-cms/core';

export const Posts = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		text('slug', { required: true, unique: true }),
		richText('content'),
	],
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
		update: ({ req }) => !!req.user,
		delete: ({ req }) => !!req.user,
	},
});

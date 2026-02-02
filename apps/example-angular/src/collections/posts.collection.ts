import { defineCollection, text, textarea, checkbox, select } from '@momentum-cms/core';

export const Posts = defineCollection({
	slug: 'posts',
	labels: {
		singular: 'Post',
		plural: 'Posts',
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		text('slug', { required: true, label: 'URL Slug' }),
		textarea('content', { label: 'Content' }),
		select('status', {
			label: 'Status',
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
				{ label: 'Archived', value: 'archived' },
			],
		}),
		checkbox('featured', { label: 'Featured Post' }),
	],
});

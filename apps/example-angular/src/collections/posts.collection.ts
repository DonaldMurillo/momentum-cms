import {
	defineCollection,
	text,
	textarea,
	checkbox,
	select,
	// Access helpers
	allowAll,
	hasRole,
	hasAnyRole,
	isAuthenticated,
} from '@momentum-cms/core';

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
	access: {
		// Anyone can read posts (public content)
		read: allowAll(),
		// Editors and admins can create posts (not viewers)
		create: hasAnyRole(['admin', 'editor']),
		// Editors and admins can update posts (not viewers)
		update: hasAnyRole(['admin', 'editor']),
		// Only admins can delete posts
		delete: hasRole('admin'),
		// Authenticated users can access posts in admin panel
		admin: isAuthenticated(),
	},
});

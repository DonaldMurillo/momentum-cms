import { defineCollection, text, textarea, select, blocks } from '@momentumcms/core';
import type { FieldHookFunction } from '@momentumcms/core';

/**
 * Auto-generate slug from title if not explicitly provided.
 */
const autoSlugFromTitle: FieldHookFunction = ({ value, data, operation }) => {
	if (value) return value;
	// On update, if slug was not in the payload (value is undefined),
	// do not derive a new slug — let the existing DB value persist.
	if (operation === 'update' && value === undefined) return undefined;
	const title = data['title'];
	if (typeof title === 'string') {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}
	return value;
};

export const Posts = defineCollection({
	slug: 'posts',
	labels: {
		singular: 'Post',
		plural: 'Posts',
	},
	admin: {
		useAsTitle: 'title',
		group: 'Content',
		preview: (doc) => '/posts/' + String(doc['slug'] ?? ''),
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		text('slug', {
			label: 'URL Slug',
			hooks: {
				beforeValidate: [autoSlugFromTitle],
			},
		}),
		blocks('pageContent', {
			label: 'Page Content',
			description: 'Build your post using content blocks.',
			blocks: [
				{
					slug: 'hero',
					labels: { singular: 'Hero', plural: 'Heroes' },
					fields: [
						text('heading', { required: true, label: 'Heading' }),
						textarea('subheading', { label: 'Subheading' }),
						text('ctaText', { label: 'CTA Button Text' }),
						text('ctaLink', { label: 'CTA Button Link' }),
					],
				},
				{
					slug: 'textBlock',
					labels: { singular: 'Text Block', plural: 'Text Blocks' },
					fields: [
						text('heading', { label: 'Section Heading' }),
						textarea('body', { required: true, label: 'Body Text' }),
					],
				},
				{
					slug: 'imageText',
					labels: { singular: 'Image + Text', plural: 'Image + Text Blocks' },
					fields: [
						text('heading', { required: true, label: 'Heading' }),
						textarea('body', { required: true, label: 'Body Text' }),
						text('imageUrl', { label: 'Image URL' }),
						text('imageAlt', { label: 'Image Alt Text' }),
						select('imagePosition', {
							label: 'Image Position',
							options: [
								{ label: 'Left', value: 'left' },
								{ label: 'Right', value: 'right' },
							],
						}),
					],
				},
			],
		}),
	],
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
		update: ({ req }) => !!req.user,
		delete: ({ req }) => !!req.user,
	},
});

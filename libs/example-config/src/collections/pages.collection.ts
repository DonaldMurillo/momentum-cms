import { defineCollection, text, textarea, blocks, allowAll, hasRole } from '@momentumcms/core';

/**
 * Pages collection for testing blocks field renderer.
 */
export const Pages = defineCollection({
	slug: 'pages',
	labels: {
		singular: 'Page',
		plural: 'Pages',
	},
	admin: {
		group: 'Content',
		preview: (doc) => '/' + String(doc['slug'] ?? ''),
	},
	fields: [
		text('title', { required: true, label: 'Page Title' }),
		text('slug', { required: true, label: 'URL Slug' }),
		blocks('content', {
			label: 'Page Content',
			description: 'Build your page using content blocks.',
			admin: { editor: 'visual' },
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
					slug: 'feature',
					labels: { singular: 'Feature', plural: 'Features' },
					fields: [
						text('title', { required: true, label: 'Feature Title' }),
						textarea('description', { label: 'Feature Description' }),
						text('icon', { label: 'Icon Name' }),
					],
				},
			],
		}),
	],
	access: {
		read: allowAll(),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
		admin: hasRole('admin'),
	},
});

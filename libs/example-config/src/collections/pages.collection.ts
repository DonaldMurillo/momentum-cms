import {
	defineCollection,
	text,
	textarea,
	select,
	checkbox,
	relationship,
	array,
	blocks,
	allowAll,
	hasRole,
} from '@momentumcms/core';
import { FormsCollection } from '@momentumcms/plugins-form-builder/collections';

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
				{
					slug: 'callToAction',
					labels: { singular: 'Call to Action', plural: 'Calls to Action' },
					fields: [
						text('heading', { required: true, label: 'Heading' }),
						textarea('description', { label: 'Description' }),
						text('primaryButtonText', { label: 'Primary Button Text' }),
						text('primaryButtonLink', { label: 'Primary Button Link' }),
						text('secondaryButtonText', { label: 'Secondary Button Text' }),
						text('secondaryButtonLink', { label: 'Secondary Button Link' }),
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
				{
					slug: 'stats',
					labels: { singular: 'Statistics', plural: 'Statistics Blocks' },
					fields: [
						text('heading', { label: 'Section Heading' }),
						textarea('description', { label: 'Section Description' }),
						array('items', {
							label: 'Stat Items',
							fields: [
								text('value', { required: true, label: 'Value' }),
								text('label', { required: true, label: 'Label' }),
								text('suffix', { label: 'Suffix (e.g., +, %, K)' }),
							],
							minRows: 1,
							maxRows: 6,
						}),
					],
				},
				{
					slug: 'testimonial',
					labels: { singular: 'Testimonial', plural: 'Testimonials' },
					fields: [
						textarea('quote', { required: true, label: 'Quote' }),
						text('authorName', { required: true, label: 'Author Name' }),
						text('authorRole', { label: 'Author Role / Title' }),
						text('authorCompany', { label: 'Company' }),
					],
				},
				{
					slug: 'featureGrid',
					labels: { singular: 'Feature Grid', plural: 'Feature Grids' },
					fields: [
						text('heading', { label: 'Section Heading' }),
						textarea('description', { label: 'Section Description' }),
						array('features', {
							label: 'Features',
							fields: [
								text('title', { required: true, label: 'Feature Title' }),
								textarea('description', { label: 'Feature Description' }),
								text('icon', { label: 'Icon Name' }),
							],
							minRows: 1,
							maxRows: 12,
						}),
					],
				},
				{
					slug: 'form',
					labels: { singular: 'Form', plural: 'Forms' },
					fields: [
						relationship('form', {
							required: true,
							label: 'Form',
							collection: () => FormsCollection,
							filterOptions: () => ({ 'status[equals]': 'published' }),
						}),
						checkbox('showHoneypot', { label: 'Enable Honeypot Anti-Spam' }),
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

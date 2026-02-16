import {
	defineCollection,
	text,
	textarea,
	number,
	checkbox,
	group,
	array,
	allowAll,
} from '@momentumcms/core';

/**
 * Products collection for testing group and array field renderers.
 */
export const Products = defineCollection({
	slug: 'products',
	labels: {
		singular: 'Product',
		plural: 'Products',
	},
	fields: [
		text('name', { required: true, label: 'Product Name' }),
		textarea('description', { label: 'Description' }),
		number('price', {
			label: 'Price',
			min: 0,
			displayFormat: { style: 'currency', currency: 'USD', minimumFractionDigits: 2 },
		}),
		group('seo', {
			label: 'SEO Settings',
			description: 'Search engine optimization settings for this product.',
			fields: [
				text('metaTitle', { label: 'Meta Title' }),
				textarea('metaDescription', { label: 'Meta Description' }),
				text('ogImage', { label: 'OG Image URL' }),
			],
		}),
		array('features', {
			label: 'Features',
			description: 'Product features list.',
			fields: [
				text('label', { required: true, label: 'Feature Label' }),
				text('description', { label: 'Feature Description' }),
				checkbox('highlighted', { label: 'Highlighted' }),
			],
			minRows: 0,
			maxRows: 10,
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

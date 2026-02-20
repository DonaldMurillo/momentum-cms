import {
	defineCollection,
	text,
	richText,
	relationship,
	upload,
	allowAll,
} from '@momentumcms/core';
import type { FieldHookFunction } from '@momentumcms/core';
import { Categories } from './categories.collection';

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

/**
 * Collection with relationship for seeding E2E tests.
 * Tests dependency resolution via getSeeded().
 * Also tests versioning functionality.
 */
export const Articles = defineCollection({
	slug: 'articles',
	labels: {
		singular: 'Article',
		plural: 'Articles',
	},
	admin: {
		group: 'Content',
		preview: (doc) => '/articles/' + String(doc['slug'] ?? ''),
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		text('slug', {
			label: 'URL Slug',
			hooks: {
				beforeValidate: [autoSlugFromTitle],
			},
		}),
		upload('coverImage', {
			label: 'Cover Image',
			relationTo: 'media',
			mimeTypes: ['image/*'],
			maxSize: 5 * 1024 * 1024, // 5MB
		}),
		richText('content', { label: 'Content' }),
		relationship('category', {
			label: 'Category',
			collection: () => Categories,
		}),
	],
	// Enable versioning with drafts for E2E testing
	versions: {
		drafts: true,
		maxPerDoc: 10,
	},
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
		// Version access controls - allow all for testing
		readVersions: allowAll(),
		publishVersions: allowAll(),
		restoreVersions: allowAll(),
	},
});

import { describe, it, expect } from 'vitest';
import { mediaOrganizerPlugin } from '../media-organizer-plugin';
import type { CollectionConfig } from '@momentumcms/core';

function makeUploadCollection(slug = 'media'): CollectionConfig {
	return {
		slug,
		labels: { singular: 'Media', plural: 'Media' },
		upload: { mimeTypes: ['image/*'] },
		fields: [{ name: 'filename', type: 'text', required: true, label: 'Filename' }],
	};
}

function makeNonUploadCollection(slug = 'posts'): CollectionConfig {
	return {
		slug,
		labels: { singular: 'Post', plural: 'Posts' },
		fields: [{ name: 'title', type: 'text', required: true, label: 'Title' }],
	};
}

describe('mediaOrganizerPlugin', () => {
	it('should have name "media-organizer"', () => {
		const plugin = mediaOrganizerPlugin();
		expect(plugin.name).toBe('media-organizer');
	});

	it('should declare media-folders and media-tags collections', () => {
		const plugin = mediaOrganizerPlugin();
		expect(plugin.collections).toBeDefined();
		expect(plugin.collections?.some((c) => c.slug === 'media-folders')).toBe(true);
		expect(plugin.collections?.some((c) => c.slug === 'media-tags')).toBe(true);
	});

	describe('modifyCollections', () => {
		it('should inject folder and tags fields into upload collections', () => {
			const plugin = mediaOrganizerPlugin();
			const media = makeUploadCollection();
			const collections = [media];

			plugin.modifyCollections?.(collections);

			const folderField = media.fields.find((f) => f.name === 'folder');
			const tagsField = media.fields.find((f) => f.name === 'tags');
			expect(folderField).toBeDefined();
			expect(folderField?.type).toBe('relationship');
			expect(tagsField).toBeDefined();
			expect(tagsField?.type).toBe('relationship');
			if (tagsField?.type === 'relationship') {
				expect(tagsField.hasMany).toBe(true);
			}
		});

		it('should NOT inject into non-upload collections', () => {
			const plugin = mediaOrganizerPlugin();
			const posts = makeNonUploadCollection();
			const collections = [posts];

			plugin.modifyCollections?.(collections);

			expect(posts.fields.find((f) => f.name === 'folder')).toBeUndefined();
			expect(posts.fields.find((f) => f.name === 'tags')).toBeUndefined();
		});

		it('should be idempotent — skip if fields already exist', () => {
			const plugin = mediaOrganizerPlugin();
			const media = makeUploadCollection();
			const collections = [media];

			plugin.modifyCollections?.(collections);
			const fieldCountAfterFirst = media.fields.length;

			plugin.modifyCollections?.(collections);
			expect(media.fields.length).toBe(fieldCountAfterFirst);
		});

		it('should inject into multiple upload collections', () => {
			const plugin = mediaOrganizerPlugin();
			const media = makeUploadCollection('media');
			const gallery = makeUploadCollection('gallery');
			const collections = [media, gallery];

			plugin.modifyCollections?.(collections);

			expect(media.fields.find((f) => f.name === 'folder')).toBeDefined();
			expect(gallery.fields.find((f) => f.name === 'folder')).toBeDefined();
		});

		it('should not inject when plugin is disabled', () => {
			const plugin = mediaOrganizerPlugin({ enabled: false });
			const media = makeUploadCollection();
			const collections = [media];

			plugin.modifyCollections?.(collections);

			expect(media.fields.find((f) => f.name === 'folder')).toBeUndefined();
		});

		it('should work with empty collections array', () => {
			const plugin = mediaOrganizerPlugin();
			const collections: CollectionConfig[] = [];

			expect(() => plugin.modifyCollections?.(collections)).not.toThrow();
		});
	});
});

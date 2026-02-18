import { describe, it, expect } from 'vitest';
import type { CollectionConfig } from '../collection.types';
import { isUploadCollection, getUploadFieldMapping } from '../define-collection';
import { text } from '../../fields';

function createBaseCollection(overrides: Partial<CollectionConfig> = {}): CollectionConfig {
	return {
		slug: 'test',
		fields: [text('title', { required: true })],
		...overrides,
	};
}

describe('isUploadCollection', () => {
	it('should return false for a regular collection without upload config', () => {
		const config = createBaseCollection();
		expect(isUploadCollection(config)).toBe(false);
	});

	it('should return true for a collection with upload config', () => {
		const config = createBaseCollection({
			upload: { mimeTypes: ['image/*'] },
		});
		expect(isUploadCollection(config)).toBe(true);
	});

	it('should return true for a collection with empty upload config', () => {
		const config = createBaseCollection({ upload: {} });
		expect(isUploadCollection(config)).toBe(true);
	});
});

describe('getUploadFieldMapping', () => {
	it('should return null for a regular collection', () => {
		const config = createBaseCollection();
		expect(getUploadFieldMapping(config)).toBeNull();
	});

	it('should return default field names when no custom mapping specified', () => {
		const config = createBaseCollection({ upload: {} });
		const mapping = getUploadFieldMapping(config);

		expect(mapping).toEqual({
			filename: 'filename',
			mimeType: 'mimeType',
			filesize: 'filesize',
			path: 'path',
			url: 'url',
		});
	});

	it('should return custom field names when specified', () => {
		const config = createBaseCollection({
			upload: {
				filenameField: 'file_name',
				mimeTypeField: 'content_type',
				filesizeField: 'size',
				pathField: 'storage_path',
				urlField: 'public_url',
			},
		});
		const mapping = getUploadFieldMapping(config);

		expect(mapping).toEqual({
			filename: 'file_name',
			mimeType: 'content_type',
			filesize: 'size',
			path: 'storage_path',
			url: 'public_url',
		});
	});

	it('should mix defaults with custom field names', () => {
		const config = createBaseCollection({
			upload: {
				filenameField: 'file_name',
				// other fields use defaults
			},
		});
		const mapping = getUploadFieldMapping(config);

		expect(mapping).not.toBeNull();
		expect(mapping!.filename).toBe('file_name');
		expect(mapping!.mimeType).toBe('mimeType');
		expect(mapping!.filesize).toBe('filesize');
		expect(mapping!.path).toBe('path');
		expect(mapping!.url).toBe('url');
	});
});

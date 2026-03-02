import { describe, it, expect } from 'vitest';
import type { ImageProcessor, ImageSizeConfig, ImageDimensions } from '../lib/storage';
import type { UploadCollectionConfig } from '../lib/collections/collection.types';
import type { MediaDocument } from '../lib/collections/media.collection';

describe('ImageProcessor interface contract', () => {
	it('should accept a valid ImageProcessor implementation', () => {
		const processor: ImageProcessor = {
			getDimensions: async (_buf, _mime) => ({ width: 100, height: 100 }),
			processVariant: async (_buf, _mime, _size) => ({
				buffer: new Uint8Array(0),
				width: 100,
				height: 100,
				mimeType: 'image/jpeg',
			}),
		};
		expect(processor).toBeDefined();
		expect(typeof processor.getDimensions).toBe('function');
		expect(typeof processor.processVariant).toBe('function');
	});

	it('should accept processVariant with focalPoint parameter', () => {
		const processor: ImageProcessor = {
			getDimensions: async () => ({ width: 1, height: 1 }),
			processVariant: async (_buf, _mime, _size, _focalPoint) => ({
				buffer: new Uint8Array(0),
				width: 50,
				height: 50,
				mimeType: 'image/webp',
			}),
		};
		expect(processor).toBeDefined();
	});
});

describe('ImageSizeConfig', () => {
	it('should accept minimal config with only name and width', () => {
		const size: ImageSizeConfig = { name: 'thumbnail', width: 200 };
		expect(size.name).toBe('thumbnail');
		expect(size.width).toBe(200);
		expect(size.height).toBeUndefined();
		expect(size.fit).toBeUndefined();
		expect(size.format).toBeUndefined();
		expect(size.quality).toBeUndefined();
	});

	it('should accept full config with all options', () => {
		const size: ImageSizeConfig = {
			name: 'hero',
			width: 1200,
			height: 630,
			fit: 'cover',
			format: 'webp',
			quality: 85,
		};
		expect(size.fit).toBe('cover');
		expect(size.format).toBe('webp');
		expect(size.quality).toBe(85);
	});

	it('should accept all fit modes', () => {
		const fits: ImageSizeConfig['fit'][] = ['contain', 'cover', 'fill', 'width', 'height'];
		for (const fit of fits) {
			const size: ImageSizeConfig = { name: 'test', width: 100, fit };
			expect(size.fit).toBe(fit);
		}
	});

	it('should accept all format options', () => {
		const formats: ImageSizeConfig['format'][] = ['jpeg', 'webp', 'avif', 'png'];
		for (const format of formats) {
			const size: ImageSizeConfig = { name: 'test', width: 100, format };
			expect(size.format).toBe(format);
		}
	});
});

describe('ImageDimensions', () => {
	it('should hold width and height', () => {
		const dims: ImageDimensions = { width: 1920, height: 1080 };
		expect(dims.width).toBe(1920);
		expect(dims.height).toBe(1080);
	});
});

describe('UploadCollectionConfig imageSizes extension', () => {
	it('should allow imageSizes in upload config', () => {
		const uploadConfig: UploadCollectionConfig = {
			mimeTypes: ['image/*'],
			imageSizes: [
				{ name: 'thumbnail', width: 150, height: 150, fit: 'cover' },
				{ name: 'medium', width: 800 },
			],
		};
		expect(uploadConfig.imageSizes).toHaveLength(2);
		expect(uploadConfig.imageSizes?.[0].name).toBe('thumbnail');
	});

	it('should allow formatPreference in upload config', () => {
		const uploadConfig: UploadCollectionConfig = {
			mimeTypes: ['image/*'],
			formatPreference: 'webp',
		};
		expect(uploadConfig.formatPreference).toBe('webp');
	});

	it('should be backward compatible without image fields', () => {
		const uploadConfig: UploadCollectionConfig = {
			mimeTypes: ['image/*', 'application/pdf'],
			maxFileSize: 5 * 1024 * 1024,
		};
		expect(uploadConfig.imageSizes).toBeUndefined();
		expect(uploadConfig.formatPreference).toBeUndefined();
	});
});

describe('MediaDocument sizes extension', () => {
	it('should allow sizes field on MediaDocument', () => {
		const doc: MediaDocument = {
			id: '1',
			filename: 'test.jpg',
			mimeType: 'image/jpeg',
			path: 'uploads/test.jpg',
			createdAt: '2026-01-01',
			updatedAt: '2026-01-01',
			sizes: {
				thumbnail: {
					url: '/api/media/file/test-thumbnail.webp',
					path: 'uploads/test-thumbnail.webp',
					width: 150,
					height: 150,
					mimeType: 'image/webp',
					filesize: 5000,
				},
			},
		};
		expect(doc.sizes).toBeDefined();
		expect(doc.sizes?.['thumbnail'].width).toBe(150);
	});

	it('should be backward compatible without sizes', () => {
		const doc: MediaDocument = {
			id: '2',
			filename: 'doc.pdf',
			mimeType: 'application/pdf',
			path: 'uploads/doc.pdf',
			createdAt: '2026-01-01',
			updatedAt: '2026-01-01',
		};
		expect(doc.sizes).toBeUndefined();
	});
});

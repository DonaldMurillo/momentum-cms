import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imagePlugin } from '../image-plugin';
import type { CollectionConfig, ImageProcessor, MomentumConfig } from '@momentumcms/core';
import type { PluginContext } from '@momentumcms/plugins/core';

function createMockProcessor(): ImageProcessor {
	return {
		getDimensions: vi.fn().mockResolvedValue({ width: 10, height: 10 }),
		processVariant: vi.fn().mockResolvedValue({
			buffer: new Uint8Array([1, 2, 3]),
			width: 5,
			height: 5,
			mimeType: 'image/png',
		}),
	};
}

function createMockContext(collections: CollectionConfig[], hasStorage = true): PluginContext {
	return {
		config: {
			collections: [],
			storage: hasStorage
				? {
						adapter: {
							upload: vi.fn(),
							delete: vi.fn(),
							getUrl: vi.fn(),
							exists: vi.fn(),
						},
					}
				: undefined,
		} as unknown as MomentumConfig,
		collections,
		logger: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	};
}

function makeUploadCollection(slug = 'media'): CollectionConfig {
	return {
		slug,
		fields: [],
		upload: {
			mimeTypes: ['image/*'],
			imageSizes: [
				{ name: 'thumbnail', width: 150, height: 150, fit: 'cover' },
				{ name: 'medium', width: 800 },
			],
		},
	};
}

function makeUploadCollectionWithoutSizes(slug = 'docs'): CollectionConfig {
	return {
		slug,
		fields: [],
		upload: {
			mimeTypes: ['application/pdf', 'image/*'],
		},
	};
}

function makeRegularCollection(slug = 'posts'): CollectionConfig {
	return { slug, fields: [] };
}

describe('imagePlugin', () => {
	let processor: ImageProcessor;

	beforeEach(() => {
		processor = createMockProcessor();
	});

	it('should have the correct plugin name', () => {
		const plugin = imagePlugin({ processor });
		expect(plugin.name).toBe('@momentumcms/plugins-image');
	});

	describe('onInit', () => {
		it('should inject beforeChange hook into upload collections with imageSizes', () => {
			const collections = [makeUploadCollection()];
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.beforeChange).toHaveLength(1);
		});

		it('should NOT inject afterChange hook by default (reprocessOnFocalPointChange defaults to false)', () => {
			const collections = [makeUploadCollection()];
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.afterChange ?? []).toHaveLength(0);
		});

		it('should inject afterChange when reprocessOnFocalPointChange is explicitly true', () => {
			const collections = [makeUploadCollection()];
			const plugin = imagePlugin({ processor, reprocessOnFocalPointChange: true });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.afterChange).toHaveLength(1);
		});

		it('should NOT inject afterChange when reprocessOnFocalPointChange is false', () => {
			const collections = [makeUploadCollection()];
			const plugin = imagePlugin({ processor, reprocessOnFocalPointChange: false });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.afterChange ?? []).toHaveLength(0);
		});

		it('reprocess stub should log a warning and not throw', async () => {
			const collections = [makeUploadCollection()];
			const context = createMockContext(collections);
			const plugin = imagePlugin({ processor, reprocessOnFocalPointChange: true });
			plugin.onInit?.(context);

			const afterHook = collections[0].hooks?.afterChange?.[0];
			expect(afterHook).toBeDefined();

			await expect(
				afterHook?.({
					req: { user: { id: '1' } },
					doc: { id: 'media-1', path: 'photo.jpg', focalPoint: { x: 0.6, y: 0.4 } },
					originalDoc: { id: 'media-1', path: 'photo.jpg', focalPoint: { x: 0.5, y: 0.5 } },
					operation: 'update',
				}),
			).resolves.toBeUndefined();

			expect(context.logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('not yet implemented'),
			);
		});

		it('should NOT inject hooks into non-upload collections', () => {
			const collections = [makeRegularCollection()];
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks).toBeUndefined();
		});

		it('should NOT inject hooks into upload collections without imageSizes', () => {
			const collections = [makeUploadCollectionWithoutSizes()];
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.beforeChange ?? []).toHaveLength(0);
		});

		it('should inject hooks into multiple upload collections', () => {
			const collections = [
				makeUploadCollection('media'),
				makeUploadCollection('avatars'),
				makeRegularCollection('posts'),
			];
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.beforeChange).toHaveLength(1);
			expect(collections[1].hooks?.beforeChange).toHaveLength(1);
			expect(collections[2].hooks).toBeUndefined();
		});

		it('should preserve existing hooks when injecting', () => {
			const existingHook = vi.fn();
			const collections = [makeUploadCollection()];
			collections[0].hooks = { beforeChange: [existingHook] };

			const plugin = imagePlugin({ processor });
			plugin.onInit?.(createMockContext(collections));

			expect(collections[0].hooks?.beforeChange).toHaveLength(2);
			expect(collections[0].hooks?.beforeChange?.[0]).toBe(existingHook);
		});

		it('should warn and skip when no storage adapter is configured', () => {
			const collections = [makeUploadCollection()];
			const context = createMockContext(collections, false);
			const plugin = imagePlugin({ processor });
			plugin.onInit?.(context);

			expect(context.logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('no storage adapter'),
			);
			expect(collections[0].hooks?.beforeChange ?? []).toHaveLength(0);
		});
	});
});

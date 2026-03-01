import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createImageProcessingHook } from '../hooks/image-processing-hook';
import { localStorageAdapter } from '@momentumcms/storage';
import type { ImageProcessor, ImageSizeConfig, HookArgs } from '@momentumcms/core';

// Valid 10x10 red PNG
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR4nGP4z8DwnxjMMKrwP12DBwCSw8c5lI9cnwAAAABJRU5ErkJggg==',
	'base64',
);

function createMockProcessor(): ImageProcessor {
	return {
		getDimensions: vi.fn().mockResolvedValue({ width: 10, height: 10 }),
		processVariant: vi.fn().mockResolvedValue({
			buffer: TINY_PNG,
			width: 5,
			height: 5,
			mimeType: 'image/png',
		}),
	};
}

describe('createImageProcessingHook (beforeChange)', () => {
	let tmpDir: string;
	let processor: ImageProcessor;

	const imageSizes: ImageSizeConfig[] = [
		{ name: 'thumbnail', width: 5, height: 5, fit: 'cover' },
		{ name: 'medium', width: 8 },
	];

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'mcms-img-'));
		processor = createMockProcessor();
	});

	afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

	function makeHookArgs(data: Record<string, unknown>): HookArgs {
		return { req: { user: { id: '1' } }, data, operation: 'create' };
	}

	it('should auto-populate width and height from getDimensions', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			filename: 'test.png',
			path: 'test.png',
		};

		const result = await hook(makeHookArgs(data));

		expect(result?.['width']).toBe(10);
		expect(result?.['height']).toBe(10);
		expect(processor.getDimensions).toHaveBeenCalledOnce();
	});

	it('should call processVariant for each size config', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
		};

		await hook(makeHookArgs(data));

		expect(processor.processVariant).toHaveBeenCalledTimes(imageSizes.length);
	});

	it('should populate sizes field with variant metadata', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
		};

		const result = await hook(makeHookArgs(data));
		const sizes = result?.['sizes'] as Record<string, Record<string, unknown>>;

		expect(sizes).toBeDefined();
		expect(sizes['thumbnail']).toBeDefined();
		expect(sizes['medium']).toBeDefined();
		expect(sizes['thumbnail']['width']).toBe(5);
		expect(sizes['thumbnail']['height']).toBe(5);
		expect(sizes['thumbnail']['mimeType']).toBe('image/png');
		expect(sizes['thumbnail']['url']).toBeTruthy();
		expect(sizes['thumbnail']['path']).toBeTruthy();
	});

	it('should pass focalPoint from data to processVariant', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const focalPoint = { x: 0.3, y: 0.7 };
		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
			focalPoint,
		};

		await hook(makeHookArgs(data));

		expect(processor.processVariant).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			'image/png',
			expect.any(Object),
			focalPoint,
		);
	});

	it('should skip processing for non-image uploads (no _file)', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = { title: 'a blog post' };
		const result = await hook(makeHookArgs(data));

		expect(processor.getDimensions).not.toHaveBeenCalled();
		// Returns cleaned data without _file (no-op, but _file is still stripped)
		expect(result).toEqual({ title: 'a blog post' });
	});

	it('should skip processing when mimeType is not a processable image', async () => {
		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: Buffer.from('%PDF'),
				mimeType: 'application/pdf',
				originalName: 'doc.pdf',
				size: 4,
			},
			path: 'doc.pdf',
		};

		const result = await hook(makeHookArgs(data));

		expect(processor.getDimensions).not.toHaveBeenCalled();
		// _file is stripped, only path remains
		expect(result).toEqual({ path: 'doc.pdf' });
		expect(result?.['_file']).toBeUndefined();
	});

	it('should continue when a variant fails — logs error, produces partial sizes', async () => {
		(processor.processVariant as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ buffer: TINY_PNG, width: 5, height: 5, mimeType: 'image/png' })
			.mockRejectedValueOnce(new Error('Encoding failed'));

		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
		};

		// Should not throw
		const result = await hook(makeHookArgs(data));

		expect(result?.['width']).toBe(10);
		const sizes = result?.['sizes'] as Record<string, unknown>;
		expect(Object.keys(sizes)).toHaveLength(1);
		// Verify the successful variant is 'thumbnail' (first in order, resolved before the rejection)
		expect(sizes['thumbnail']).toBeDefined();
		expect(sizes['medium']).toBeUndefined();
	});

	it('should call logger.error when a variant fails and logger is provided', async () => {
		const mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		};

		(processor.processVariant as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ buffer: TINY_PNG, width: 5, height: 5, mimeType: 'image/png' })
			.mockRejectedValueOnce(new Error('Encoding failed'));

		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({
			processor,
			adapter,
			imageSizes,
			logger: mockLogger,
		});

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
		};

		await hook(makeHookArgs(data));

		expect(mockLogger.error).toHaveBeenCalledOnce();
		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining('medium'),
			expect.any(Error),
		);
	});

	it('should fall back to console.error when no logger is provided', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		(processor.processVariant as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ buffer: TINY_PNG, width: 5, height: 5, mimeType: 'image/png' })
			.mockRejectedValueOnce(new Error('Encoding failed'));

		const adapter = localStorageAdapter({ directory: tmpDir });
		const hook = createImageProcessingHook({ processor, adapter, imageSizes });

		const data: Record<string, unknown> = {
			_file: {
				buffer: TINY_PNG,
				mimeType: 'image/png',
				originalName: 'test.png',
				size: TINY_PNG.length,
			},
			path: 'test.png',
		};

		await hook(makeHookArgs(data));

		expect(consoleSpy).toHaveBeenCalledOnce();
		consoleSpy.mockRestore();
	});
});

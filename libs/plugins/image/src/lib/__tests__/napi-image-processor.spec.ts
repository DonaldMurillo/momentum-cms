import { describe, it, expect, beforeAll } from 'vitest';
import { NapiImageProcessor } from '../napi-image-processor';

// Synthetic 10x10 red PNG generated via @napi-rs/image (valid CRC)
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR4nGP4z8DwnxjMMKrwP12DBwCSw8c5lI9cnwAAAABJRU5ErkJggg==',
	'base64',
);

describe('NapiImageProcessor', () => {
	let processor: NapiImageProcessor;

	beforeAll(() => {
		processor = new NapiImageProcessor();
	});

	describe('getDimensions', () => {
		it('should return width and height for a valid PNG', async () => {
			const dims = await processor.getDimensions(TINY_PNG, 'image/png');
			expect(dims.width).toBe(10);
			expect(dims.height).toBe(10);
		});

		it('should throw for an invalid buffer', async () => {
			await expect(
				processor.getDimensions(Buffer.from([0x00, 0x01, 0x02]), 'image/jpeg'),
			).rejects.toThrow();
		});
	});

	describe('processVariant', () => {
		it('should resize PNG to specified dimensions', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'thumb',
				width: 5,
				height: 5,
				fit: 'cover',
			});
			expect(result.width).toBe(5);
			expect(result.height).toBe(5);
			expect(result.buffer.length).toBeGreaterThan(0);
		});

		it('should maintain aspect ratio with width-only resize', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'scaled',
				width: 5,
				fit: 'width',
			});
			expect(result.width).toBe(5);
			expect(result.height).toBe(5); // 10x10 source, proportional
		});

		it('should convert to WebP when format is webp', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'webp-thumb',
				width: 5,
				height: 5,
				format: 'webp',
			});
			expect(result.mimeType).toBe('image/webp');
			// WebP magic bytes: RIFF
			expect(result.buffer[0]).toBe(0x52); // 'R'
			expect(result.buffer[1]).toBe(0x49); // 'I'
		});

		it('should convert to JPEG when format is jpeg', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'jpeg-thumb',
				width: 5,
				height: 5,
				format: 'jpeg',
			});
			expect(result.mimeType).toBe('image/jpeg');
			// JPEG magic bytes: FF D8 FF
			expect(result.buffer[0]).toBe(0xff);
			expect(result.buffer[1]).toBe(0xd8);
		});

		it('should keep PNG format when no format specified and source is PNG', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'keep-png',
				width: 5,
				height: 5,
				fit: 'cover',
			});
			expect(result.mimeType).toBe('image/png');
			// PNG magic: 89 50 4E 47
			expect(result.buffer[0]).toBe(0x89);
			expect(result.buffer[1]).toBe(0x50);
		});

		it('should apply focal point for cover crop without errors', async () => {
			const result = await processor.processVariant(
				TINY_PNG,
				'image/png',
				{ name: 'focal', width: 5, height: 5, fit: 'cover' },
				{ x: 1.0, y: 0.0 },
			);
			expect(result.buffer.length).toBeGreaterThan(0);
			expect(result.width).toBe(5);
			expect(result.height).toBe(5);
		});

		it('should handle contain fit mode', async () => {
			const result = await processor.processVariant(TINY_PNG, 'image/png', {
				name: 'contained',
				width: 5,
				height: 3,
				fit: 'contain',
			});
			// Contain should fit within 5x3 while maintaining aspect ratio
			// 10x10 → max(5/10, 3/10) = 0.3, so 3x3
			expect(result.width).toBeLessThanOrEqual(5);
			expect(result.height).toBeLessThanOrEqual(3);
		});
	});
});

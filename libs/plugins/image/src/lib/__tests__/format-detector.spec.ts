import { describe, it, expect } from 'vitest';
import { isProcessableImage, detectImageFormat } from '../format-detector';

// Magic byte headers
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const AVIF_FTYP = Buffer.from([
	0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a

describe('isProcessableImage', () => {
	it('should return true for JPEG', () => {
		expect(isProcessableImage(JPEG, 'image/jpeg')).toBe(true);
	});

	it('should return true for PNG', () => {
		expect(isProcessableImage(PNG, 'image/png')).toBe(true);
	});

	it('should return true for WebP', () => {
		expect(isProcessableImage(WEBP, 'image/webp')).toBe(true);
	});

	it('should return true for AVIF', () => {
		expect(isProcessableImage(AVIF_FTYP, 'image/avif')).toBe(true);
	});

	it('should return false for PDF', () => {
		expect(isProcessableImage(PDF, 'application/pdf')).toBe(false);
	});

	it('should return false for GIF (not supported for processing)', () => {
		expect(isProcessableImage(GIF, 'image/gif')).toBe(false);
	});

	it('should return false for non-image MIME type even with image bytes', () => {
		expect(isProcessableImage(JPEG, 'video/mp4')).toBe(false);
	});

	it('should return false for empty buffer', () => {
		expect(isProcessableImage(Buffer.alloc(0), 'image/jpeg')).toBe(false);
	});

	it('should return false for buffer too small for magic bytes', () => {
		expect(isProcessableImage(Buffer.from([0xff]), 'image/jpeg')).toBe(false);
	});
});

describe('detectImageFormat', () => {
	it('should detect jpeg', () => {
		expect(detectImageFormat(JPEG)).toBe('jpeg');
	});

	it('should detect png', () => {
		expect(detectImageFormat(PNG)).toBe('png');
	});

	it('should detect webp', () => {
		expect(detectImageFormat(WEBP)).toBe('webp');
	});

	it('should detect avif', () => {
		expect(detectImageFormat(AVIF_FTYP)).toBe('avif');
	});

	it('should return null for unknown format', () => {
		expect(detectImageFormat(PDF)).toBeNull();
	});

	it('should return null for empty buffer', () => {
		expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
	});

	it('should return null for GIF', () => {
		expect(detectImageFormat(GIF)).toBeNull();
	});
});

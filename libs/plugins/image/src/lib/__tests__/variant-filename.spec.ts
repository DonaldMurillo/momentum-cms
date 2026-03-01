import { describe, it, expect } from 'vitest';
import { buildVariantFilename } from '../variant-filename';

describe('buildVariantFilename', () => {
	it('should append size name before extension', () => {
		expect(buildVariantFilename('photo.jpg', 'thumbnail', 'jpeg')).toBe('photo-thumbnail.jpeg');
	});

	it('should replace extension with target format', () => {
		expect(buildVariantFilename('photo.jpg', 'thumb', 'webp')).toBe('photo-thumb.webp');
	});

	it('should handle path with directories', () => {
		expect(buildVariantFilename('uploads/2026/photo.png', 'medium', 'webp')).toBe(
			'uploads/2026/photo-medium.webp',
		);
	});

	it('should handle filename without extension', () => {
		expect(buildVariantFilename('noext', 'small', 'jpeg')).toBe('noext-small.jpeg');
	});

	it('should handle multiple dots in filename', () => {
		expect(buildVariantFilename('my.photo.file.png', 'large', 'avif')).toBe(
			'my.photo.file-large.avif',
		);
	});

	it('should handle UUID-style filenames', () => {
		expect(buildVariantFilename('a1b2c3d4-e5f6.jpg', 'thumbnail', 'png')).toBe(
			'a1b2c3d4-e5f6-thumbnail.png',
		);
	});
});

import { describe, it, expect } from 'vitest';
import { buildVariantFilename } from '../variant-filename';

describe('buildVariantFilename', () => {
	it('should append size name before extension', () => {
		expect(buildVariantFilename('photo.jpg', 'thumbnail', 'jpeg')).toBe('photo-thumbnail.jpeg');
	});

	it('should replace extension with target format', () => {
		expect(buildVariantFilename('photo.jpg', 'thumb', 'webp')).toBe('photo-thumb.webp');
	});

	it('should strip directory components and use only basename', () => {
		expect(buildVariantFilename('uploads/2026/photo.png', 'medium', 'webp')).toBe(
			'photo-medium.webp',
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

	describe('path traversal sanitization', () => {
		it('should strip directory traversal sequences from originalPath', () => {
			const result = buildVariantFilename('../../../../etc/passwd.jpg', 'thumbnail', 'webp');
			expect(result).not.toContain('..');
			expect(result).toBe('passwd-thumbnail.webp');
		});

		it('should strip leading directory components from originalPath', () => {
			const result = buildVariantFilename('uploads/2026/photo.png', 'medium', 'webp');
			expect(result).toBe('photo-medium.webp');
		});

		it('should handle backslash traversal on Windows-style paths', () => {
			const result = buildVariantFilename('..\\..\\etc\\passwd.jpg', 'thumbnail', 'webp');
			expect(result).not.toContain('..');
			expect(result).toBe('passwd-thumbnail.webp');
		});

		it('should strip directory separators from sizeName', () => {
			const result = buildVariantFilename('photo.jpg', '../../../evil', 'webp');
			expect(result).not.toContain('..');
			expect(result).toBe('photo-evil.webp');
		});

		it('should handle encoded path traversal attempts', () => {
			const result = buildVariantFilename('..%2F..%2Fetc%2Fpasswd.jpg', 'thumbnail', 'webp');
			expect(result).not.toContain('..');
			expect(result).not.toContain('%2F');
			expect(result).toBe('passwd-thumbnail.webp');
		});

		it('should sanitize directory traversal in format parameter', () => {
			const result = buildVariantFilename('photo.jpg', 'thumb', '../../../evil');
			expect(result).not.toContain('..');
			expect(result).toBe('photo-thumb.evil');
		});
	});
});

import { describe, it, expect } from 'vitest';
import { detectMimeType, mimeTypeMatches, isMimeTypeAllowed, validateMimeType } from './mime-validator';

describe('detectMimeType', () => {
	it('should detect JPEG from magic bytes', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		expect(detectMimeType(buffer)).toBe('image/jpeg');
	});

	it('should detect PNG from magic bytes', () => {
		const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		expect(detectMimeType(buffer)).toBe('image/png');
	});

	it('should detect GIF from magic bytes', () => {
		const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		expect(detectMimeType(buffer)).toBe('image/gif');
	});

	it('should detect PDF from magic bytes', () => {
		const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
		expect(detectMimeType(buffer)).toBe('application/pdf');
	});

	it('should detect WEBP from RIFF+WEBP header', () => {
		// RIFF....WEBP
		const buffer = Buffer.alloc(12);
		buffer.write('RIFF', 0, 'ascii');
		buffer.writeUInt32LE(100, 4); // size
		buffer.write('WEBP', 8, 'ascii');
		expect(detectMimeType(buffer)).toBe('image/webp');
	});

	it('should detect WAV from RIFF+WAVE header', () => {
		const buffer = Buffer.alloc(12);
		buffer.write('RIFF', 0, 'ascii');
		buffer.writeUInt32LE(100, 4);
		buffer.write('WAVE', 8, 'ascii');
		expect(detectMimeType(buffer)).toBe('audio/wav');
	});

	it('should detect AVI from RIFF+AVI header', () => {
		const buffer = Buffer.alloc(12);
		buffer.write('RIFF', 0, 'ascii');
		buffer.writeUInt32LE(100, 4);
		buffer.write('AVI ', 8, 'ascii');
		expect(detectMimeType(buffer)).toBe('video/avi');
	});

	it('should detect MP3 from ID3 tag', () => {
		const buffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00]);
		expect(detectMimeType(buffer)).toBe('audio/mpeg');
	});

	it('should detect MP4 from ftyp box', () => {
		const buffer = Buffer.alloc(12);
		buffer.writeUInt32BE(12, 0); // box size
		buffer.write('ftyp', 4, 'ascii');
		buffer.write('isom', 8, 'ascii');
		// MP4 detection checks bytes [0x00, 0x00, 0x00] at offset 0 + 'ftyp' at offset 4
		expect(detectMimeType(buffer)).toBe('video/mp4');
	});

	it('should detect JSON text content', () => {
		const buffer = Buffer.from('{"key": "value"}', 'utf-8');
		expect(detectMimeType(buffer)).toBe('application/json');
	});

	it('should detect JSON array text content', () => {
		const buffer = Buffer.from('[1, 2, 3]', 'utf-8');
		expect(detectMimeType(buffer)).toBe('application/json');
	});

	it('should detect plain text content', () => {
		const buffer = Buffer.from('Hello world, this is plain text.', 'utf-8');
		expect(detectMimeType(buffer)).toBe('text/plain');
	});

	it('should detect SVG from text content', () => {
		const buffer = Buffer.from(
			'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
			'utf-8',
		);
		expect(detectMimeType(buffer)).toBe('image/svg+xml');
	});

	it('should detect HTML from <!DOCTYPE pattern', () => {
		const buffer = Buffer.from('<!DOCTYPE html><html><body></body></html>', 'utf-8');
		expect(detectMimeType(buffer)).toBe('text/html');
	});

	it('should detect HTML from <html pattern', () => {
		const buffer = Buffer.from('<html><body>content</body></html>', 'utf-8');
		expect(detectMimeType(buffer)).toBe('text/html');
	});

	it('should return text/plain for empty buffer (isTextContent returns true for zero-length)', () => {
		expect(detectMimeType(Buffer.alloc(0))).toBe('text/plain');
	});

	it('should return null for unknown binary format', () => {
		// Random binary bytes that don't match any signature
		const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
		expect(detectMimeType(buffer)).toBeNull();
	});

	it('should detect Windows EXE from MZ header', () => {
		const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
		expect(detectMimeType(buffer)).toBe('application/x-msdownload');
	});

	it('should detect ELF executable', () => {
		const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]);
		expect(detectMimeType(buffer)).toBe('application/x-executable');
	});

	it('should detect ZIP from magic bytes', () => {
		const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a]);
		expect(detectMimeType(buffer)).toBe('application/zip');
	});

	it('should detect GZIP from magic bytes', () => {
		const buffer = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
		expect(detectMimeType(buffer)).toBe('application/gzip');
	});
});

describe('mimeTypeMatches', () => {
	it('should match exact MIME type', () => {
		expect(mimeTypeMatches('image/jpeg', 'image/jpeg')).toBe(true);
	});

	it('should match wildcard */*', () => {
		expect(mimeTypeMatches('image/jpeg', '*/*')).toBe(true);
	});

	it('should match single wildcard *', () => {
		expect(mimeTypeMatches('image/jpeg', '*')).toBe(true);
	});

	it('should match category wildcard image/*', () => {
		expect(mimeTypeMatches('image/jpeg', 'image/*')).toBe(true);
		expect(mimeTypeMatches('image/png', 'image/*')).toBe(true);
	});

	it('should reject mismatched category', () => {
		expect(mimeTypeMatches('audio/mpeg', 'image/*')).toBe(false);
	});

	it('should reject mismatched exact type', () => {
		expect(mimeTypeMatches('image/jpeg', 'image/png')).toBe(false);
	});

	it('should match video category wildcard', () => {
		expect(mimeTypeMatches('video/mp4', 'video/*')).toBe(true);
	});
});

describe('isMimeTypeAllowed', () => {
	it('should allow all types when allowedTypes is empty', () => {
		expect(isMimeTypeAllowed('anything/here', [])).toBe(true);
	});

	it('should allow type matching one of the patterns', () => {
		expect(isMimeTypeAllowed('image/jpeg', ['image/*', 'application/pdf'])).toBe(true);
	});

	it('should allow exact match in patterns', () => {
		expect(isMimeTypeAllowed('application/pdf', ['image/*', 'application/pdf'])).toBe(true);
	});

	it('should reject type not matching any pattern', () => {
		expect(isMimeTypeAllowed('application/zip', ['image/*', 'application/pdf'])).toBe(false);
	});

	it('should allow any type with * pattern', () => {
		expect(isMimeTypeAllowed('application/zip', ['*'])).toBe(true);
	});
});

describe('validateMimeType', () => {
	it('should validate matching detected and claimed types', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		const result = validateMimeType(buffer, 'image/jpeg');
		expect(result.valid).toBe(true);
		expect(result.detectedType).toBe('image/jpeg');
		expect(result.claimedType).toBe('image/jpeg');
	});

	it('should reject mismatched types (PNG buffer, JPEG claim)', () => {
		const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const result = validateMimeType(buffer, 'image/jpeg');
		expect(result.valid).toBe(false);
		expect(result.detectedType).toBe('image/png');
		expect(result.error).toContain('image/png');
	});

	it('should accept compatible MIME type variations (jpeg/jpg)', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		const result = validateMimeType(buffer, 'image/jpg');
		expect(result.valid).toBe(true);
	});

	it('should reject when detected type not in allowed list', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		const result = validateMimeType(buffer, 'image/jpeg', ['application/pdf']);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('not allowed');
	});

	it('should accept when detected type is null (trust claimed for unknown formats)', () => {
		// Random binary that detectMimeType returns null for
		const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
		const result = validateMimeType(buffer, 'application/octet-stream');
		expect(result.valid).toBe(true);
		expect(result.detectedType).toBeNull();
	});

	it('should reject cross-category mismatch', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG
		const result = validateMimeType(buffer, 'audio/mpeg');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('image/jpeg');
	});

	it('should accept when claimed matches and is in allowed list', () => {
		const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		const result = validateMimeType(buffer, 'image/jpeg', ['image/*']);
		expect(result.valid).toBe(true);
	});

	it('should validate PDF buffer correctly', () => {
		const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
		const result = validateMimeType(buffer, 'application/pdf', ['application/pdf']);
		expect(result.valid).toBe(true);
		expect(result.detectedType).toBe('application/pdf');
	});
});

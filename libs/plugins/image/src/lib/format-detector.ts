type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

const PROCESSABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * Check if a buffer + MIME type represents an image we can process.
 * Only JPEG, PNG, WebP, and AVIF are supported.
 */
export function isProcessableImage(buffer: Uint8Array, mimeType: string): boolean {
	if (buffer.length < 2) return false;
	if (!PROCESSABLE_MIME_TYPES.has(mimeType)) return false;
	return detectImageFormat(buffer) !== null;
}

/**
 * Detect image format from magic bytes.
 * Returns null for unsupported or unrecognized formats.
 */
export function detectImageFormat(buffer: Uint8Array): ImageFormat | null {
	if (buffer.length < 2) return null;

	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.length >= 3 && buffer[2] === 0xff) {
		return 'jpeg';
	}

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer.length >= 8 &&
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return 'png';
	}

	// WebP: RIFF....WEBP
	if (
		buffer.length >= 12 &&
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		return 'webp';
	}

	// AVIF: ftyp box with 'avif' brand (offset 4: 'ftyp', offset 8: 'avif')
	if (buffer.length >= 12) {
		const ftyp =
			buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
		const avif =
			buffer[8] === 0x61 && buffer[9] === 0x76 && buffer[10] === 0x69 && buffer[11] === 0x66;
		if (ftyp && avif) {
			return 'avif';
		}
	}

	return null;
}

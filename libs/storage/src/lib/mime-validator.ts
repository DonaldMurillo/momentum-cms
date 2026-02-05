/**
 * MIME Type Validator
 * Validates files by checking magic bytes (file signatures)
 */

import type { MimeValidationResult, FileSignature } from './storage.types';

/**
 * Common file signatures (magic bytes) for MIME type detection.
 */
const FILE_SIGNATURES: FileSignature[] = [
	// Images
	{ mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
	{ mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
	{ mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
	{ mimeType: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF (need to check for WEBP at offset 8)
	{ mimeType: 'image/bmp', bytes: [0x42, 0x4d] }, // BM
	{ mimeType: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] }, // Little-endian TIFF
	{ mimeType: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // Big-endian TIFF
	{ mimeType: 'image/x-icon', bytes: [0x00, 0x00, 0x01, 0x00] }, // ICO
	{ mimeType: 'image/svg+xml', bytes: [0x3c, 0x73, 0x76, 0x67] }, // <svg (partial match)

	// Documents
	{ mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF

	// Archives
	{ mimeType: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK
	{ mimeType: 'application/gzip', bytes: [0x1f, 0x8b] },
	{ mimeType: 'application/x-rar-compressed', bytes: [0x52, 0x61, 0x72, 0x21] }, // Rar!

	// Audio
	{ mimeType: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] }, // ID3 (MP3)
	{ mimeType: 'audio/mpeg', bytes: [0xff, 0xfb] }, // MP3 frame sync
	{ mimeType: 'audio/wav', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (need to check for WAVE)
	{ mimeType: 'audio/ogg', bytes: [0x4f, 0x67, 0x67, 0x53] }, // OggS
	{ mimeType: 'audio/flac', bytes: [0x66, 0x4c, 0x61, 0x43] }, // fLaC

	// Video
	{ mimeType: 'video/mp4', bytes: [0x00, 0x00, 0x00], offset: 0 }, // Need to check for ftyp at offset 4
	{ mimeType: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML header
	{ mimeType: 'video/avi', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (need to check for AVI)

	// Executables (for blocking)
	{ mimeType: 'application/x-executable', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // ELF
	{ mimeType: 'application/x-msdownload', bytes: [0x4d, 0x5a] }, // MZ (Windows EXE)
];

/**
 * Detect MIME type from file buffer using magic bytes.
 */
export function detectMimeType(buffer: Buffer): string | null {
	for (const sig of FILE_SIGNATURES) {
		const offset = sig.offset ?? 0;
		if (buffer.length < offset + sig.bytes.length) {
			continue;
		}

		let match = true;
		for (let i = 0; i < sig.bytes.length; i++) {
			if (buffer[offset + i] !== sig.bytes[i]) {
				match = false;
				break;
			}
		}

		if (match) {
			// Special handling for RIFF-based formats
			if (sig.bytes[0] === 0x52 && sig.bytes[1] === 0x49) {
				// Check for WEBP
				if (buffer.length >= 12) {
					const formatId = buffer.slice(8, 12).toString('ascii');
					if (formatId === 'WEBP') {
						return 'image/webp';
					}
					if (formatId === 'WAVE') {
						return 'audio/wav';
					}
					if (formatId === 'AVI ') {
						return 'video/avi';
					}
				}
			}

			// Special handling for MP4 (check for ftyp box)
			if (sig.mimeType === 'video/mp4' && buffer.length >= 8) {
				const boxType = buffer.slice(4, 8).toString('ascii');
				if (boxType === 'ftyp') {
					return 'video/mp4';
				}
			}

			return sig.mimeType;
		}
	}

	// Check for text/plain or JSON
	if (isTextContent(buffer)) {
		const text = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
		if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
			return 'application/json';
		}
		if (text.trim().startsWith('<')) {
			if (text.includes('<svg')) {
				return 'image/svg+xml';
			}
			if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
				return 'text/html';
			}
			return 'application/xml';
		}
		return 'text/plain';
	}

	return null;
}

/**
 * Check if buffer appears to be text content.
 */
function isTextContent(buffer: Buffer): boolean {
	// Check first 512 bytes for non-text characters
	const checkLength = Math.min(buffer.length, 512);
	for (let i = 0; i < checkLength; i++) {
		const byte = buffer[i];
		// Allow printable ASCII, newlines, tabs, and UTF-8 continuation bytes
		if (
			byte < 0x09 || // Control chars before tab
			(byte > 0x0d && byte < 0x20) || // Control chars between CR and space
			byte === 0x7f // DEL
		) {
			// Allow UTF-8 continuation bytes (0x80-0xBF when following a lead byte)
			if (byte >= 0x80 && byte <= 0xbf) {
				continue;
			}
			// Allow UTF-8 lead bytes
			if (byte >= 0xc0 && byte <= 0xf7) {
				continue;
			}
			return false;
		}
	}
	return true;
}

/**
 * Check if a MIME type matches a pattern.
 * Supports glob patterns like 'image/*' and 'video/*'.
 */
export function mimeTypeMatches(mimeType: string, pattern: string): boolean {
	if (pattern === '*' || pattern === '*/*') {
		return true;
	}

	if (pattern.endsWith('/*')) {
		// Category pattern like 'image/*'
		const category = pattern.slice(0, -2);
		return mimeType.startsWith(`${category}/`);
	}

	// Exact match
	return mimeType === pattern;
}

/**
 * Check if a MIME type is allowed by a list of patterns.
 */
export function isMimeTypeAllowed(mimeType: string, allowedTypes: string[]): boolean {
	if (allowedTypes.length === 0) {
		return true; // No restrictions
	}

	return allowedTypes.some((pattern) => mimeTypeMatches(mimeType, pattern));
}

/**
 * Validate a file's MIME type by checking magic bytes.
 */
export function validateMimeType(
	buffer: Buffer,
	claimedType: string,
	allowedTypes?: string[],
): MimeValidationResult {
	const detectedType = detectMimeType(buffer);

	// Check if detected type is in allowed list
	if (allowedTypes && allowedTypes.length > 0) {
		const typeToCheck = detectedType ?? claimedType;
		if (!isMimeTypeAllowed(typeToCheck, allowedTypes)) {
			return {
				valid: false,
				detectedType,
				claimedType,
				error: `File type '${typeToCheck}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
			};
		}
	}

	// If we couldn't detect the type, trust the claimed type (for unknown formats)
	if (!detectedType) {
		return {
			valid: true,
			detectedType: null,
			claimedType,
		};
	}

	// Check if detected type matches claimed type (allow compatible types)
	const compatible = areMimeTypesCompatible(detectedType, claimedType);
	if (!compatible) {
		return {
			valid: false,
			detectedType,
			claimedType,
			error: `File appears to be '${detectedType}' but was uploaded as '${claimedType}'`,
		};
	}

	return {
		valid: true,
		detectedType,
		claimedType,
	};
}

/**
 * Check if two MIME types are compatible (allowing for variations).
 */
function areMimeTypesCompatible(detected: string, claimed: string): boolean {
	// Exact match
	if (detected === claimed) {
		return true;
	}

	// Same category (e.g., image/jpeg vs image/jpg)
	const [detectedCategory] = detected.split('/');
	const [claimedCategory] = claimed.split('/');
	if (detectedCategory !== claimedCategory) {
		return false;
	}

	// Allow common variations
	const variations: Record<string, string[]> = {
		'image/jpeg': ['image/jpg', 'image/pjpeg'],
		'text/plain': ['text/x-plain'],
		'application/json': ['text/json'],
		'application/javascript': ['text/javascript', 'application/x-javascript'],
	};

	const allowedVariations = variations[detected];
	if (allowedVariations && allowedVariations.includes(claimed)) {
		return true;
	}

	// Check reverse
	for (const [canonical, variants] of Object.entries(variations)) {
		if (variants.includes(detected) && (canonical === claimed || variants.includes(claimed))) {
			return true;
		}
	}

	return false;
}

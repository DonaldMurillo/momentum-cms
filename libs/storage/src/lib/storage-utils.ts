/**
 * Shared utilities for storage adapters.
 */

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/svg+xml': '.svg',
	'application/pdf': '.pdf',
	'application/json': '.json',
	'text/plain': '.txt',
	'text/html': '.html',
	'text/css': '.css',
	'application/javascript': '.js',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'audio/mpeg': '.mp3',
	'audio/wav': '.wav',
	'application/zip': '.zip',
};

/**
 * Get file extension from MIME type.
 * Returns empty string for unknown MIME types.
 */
export function getExtensionFromMimeType(mimeType: string): string {
	return MIME_TO_EXT[mimeType] ?? '';
}

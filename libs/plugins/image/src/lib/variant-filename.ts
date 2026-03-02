/**
 * Sanitize a path segment by stripping directory components, traversal
 * sequences, encoded separators, and other unsafe characters.
 * Returns only the basename without directory separators.
 */
function sanitizePathSegment(segment: string): string {
	// Decode percent-encoded separators first
	let cleaned = segment.replace(/%2F/gi, '/').replace(/%5C/gi, '\\');
	// Extract only the basename (strip all directory components)
	const lastSep = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'));
	if (lastSep >= 0) {
		cleaned = cleaned.slice(lastSep + 1);
	}
	// Remove any remaining dots-only traversal artifacts
	cleaned = cleaned.replace(/^\.+$/, '');
	return cleaned;
}

/**
 * Build a filename for an image variant by appending the size name
 * and replacing the extension with the target format.
 *
 * Sanitizes all inputs to prevent path traversal attacks.
 *
 * @example buildVariantFilename('photo.jpg', 'thumbnail', 'webp') → 'photo-thumbnail.webp'
 */
export function buildVariantFilename(
	originalPath: string,
	sizeName: string,
	format: string,
): string {
	const safeName = sanitizePathSegment(originalPath);
	const safeSizeName = sanitizePathSegment(sizeName);
	const safeFormat = sanitizePathSegment(format);
	const lastDot = safeName.lastIndexOf('.');
	const base = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
	return `${base}-${safeSizeName}.${safeFormat}`;
}

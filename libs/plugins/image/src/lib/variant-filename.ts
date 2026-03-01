/**
 * Build a filename for an image variant by appending the size name
 * and replacing the extension with the target format.
 *
 * @example buildVariantFilename('photo.jpg', 'thumbnail', 'webp') → 'photo-thumbnail.webp'
 */
export function buildVariantFilename(
	originalPath: string,
	sizeName: string,
	format: string,
): string {
	const lastDot = originalPath.lastIndexOf('.');
	const base = lastDot > 0 ? originalPath.slice(0, lastDot) : originalPath;
	return `${base}-${sizeName}.${format}`;
}

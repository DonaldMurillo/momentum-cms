import type { ImageProcessor } from '@momentumcms/core';

/**
 * Configuration for the image processing plugin.
 */
export interface ImagePluginConfig {
	/** Custom image processor implementation. Defaults to NapiImageProcessor. */
	processor?: ImageProcessor;

	/**
	 * Global format preference for generated sizes.
	 * - 'original': keep source format
	 * - 'webp': convert all to WebP
	 * - 'avif': convert all to AVIF
	 * - 'jpeg': convert all to JPEG
	 * @default 'original'
	 */
	formatPreference?: 'jpeg' | 'webp' | 'avif' | 'original';

	/**
	 * Maximum pixel count (width * height) allowed before rejecting an image.
	 * Prevents decompression bomb attacks where a small compressed file
	 * expands to consume excessive memory during processing.
	 * @default 100_000_000 (100 megapixels)
	 */
	maxPixels?: number;
}

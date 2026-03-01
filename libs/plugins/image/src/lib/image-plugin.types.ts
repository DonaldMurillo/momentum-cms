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

	/** Re-process variants when focalPoint changes on update. @default true */
	reprocessOnFocalPointChange?: boolean;
}

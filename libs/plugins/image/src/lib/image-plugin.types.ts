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
	 * Opt-in: register a hook that detects focal point changes on update.
	 * Full variant re-processing is planned for Phase 4 and is not yet implemented.
	 * When enabled, a warning is logged on focal point change.
	 * @default false
	 */
	reprocessOnFocalPointChange?: boolean;
}

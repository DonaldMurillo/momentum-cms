import type { MomentumPlugin } from '@momentumcms/plugins/core';
import type { PluginContext } from '@momentumcms/plugins/core';
import type { ImagePluginConfig } from './image-plugin.types';
import { NapiImageProcessor } from './napi-image-processor';
import { createImageProcessingHook } from './hooks/image-processing-hook';

/**
 * Image processing plugin for Momentum CMS.
 *
 * Automatically processes uploaded images to generate size variants,
 * detect dimensions, and support focal point cropping.
 *
 * @example
 * ```typescript
 * import { imagePlugin } from '@momentumcms/plugins/image';
 *
 * export default defineMomentumConfig({
 *   plugins: [imagePlugin()],
 * });
 * ```
 */
export function imagePlugin(config: ImagePluginConfig = {}): MomentumPlugin {
	const processor = config.processor ?? new NapiImageProcessor();

	return {
		name: '@momentumcms/plugins-image',

		onInit({ collections, config: momentumConfig, logger }: PluginContext) {
			const adapter = momentumConfig.storage?.adapter;
			if (!adapter) {
				logger.warn('imagePlugin: no storage adapter configured — image processing disabled');
				return;
			}

			for (const collection of collections) {
				const upload = collection.upload;
				if (!upload?.imageSizes?.length) continue;

				collection.hooks = collection.hooks ?? {};

				// Inject beforeChange: process + store variants
				const beforeChangeHook = createImageProcessingHook({
					processor,
					adapter,
					imageSizes: upload.imageSizes,
					formatPreference: upload.formatPreference ?? config.formatPreference,
					logger,
					maxPixels: config.maxPixels,
				});
				collection.hooks.beforeChange = [
					...(collection.hooks.beforeChange ?? []),
					beforeChangeHook,
				];

				logger.info(
					`imagePlugin: hooked collection "${collection.slug}" with ${upload.imageSizes.length} sizes`,
				);
			}
		},
	};
}

import type { MomentumPlugin } from '@momentumcms/plugins/core';
import type { PluginContext } from '@momentumcms/plugins/core';
import type { ImagePluginConfig } from './image-plugin.types';
import { NapiImageProcessor } from './napi-image-processor';
import { createImageProcessingHook } from './hooks/image-processing-hook';
import { createFocalPointHook } from './hooks/focal-point-hook';

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
				});
				collection.hooks.beforeChange = [
					...(collection.hooks.beforeChange ?? []),
					beforeChangeHook,
				];

				// Inject afterChange: re-process on focal point change
				if (config.reprocessOnFocalPointChange !== false) {
					const afterChangeHook = createFocalPointHook(async (doc) => {
						if (!adapter.read) return;
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
						const filePath = doc['path'] as string | undefined;
						if (!filePath) return;

						const buf = await adapter.read(filePath);
						if (!buf) return;

						logger.info(
							`Re-processing image variants for doc ${String(doc['id'])} due to focal point change`,
						);
						// TODO: Full re-processing implementation in Phase 4
					});
					collection.hooks.afterChange = [...(collection.hooks.afterChange ?? []), afterChangeHook];
				}

				logger.info(
					`imagePlugin: hooked collection "${collection.slug}" with ${upload.imageSizes.length} sizes`,
				);
			}
		},
	};
}

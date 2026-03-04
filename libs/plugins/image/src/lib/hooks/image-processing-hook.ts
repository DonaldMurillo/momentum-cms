import type {
	HookFunction,
	StorageAdapter,
	ImageProcessor,
	ImageSizeConfig,
	UploadedFile,
	PluginLogger,
} from '@momentumcms/core';
import { isProcessableImage } from '../format-detector';
import { buildVariantFilename } from '../variant-filename';

/** 100 megapixels — safe ceiling for most server environments */
const DEFAULT_MAX_PIXELS = 100_000_000;

interface HookOptions {
	processor: ImageProcessor;
	adapter: StorageAdapter;
	imageSizes: ImageSizeConfig[];
	formatPreference?: 'jpeg' | 'webp' | 'avif' | 'original';
	logger?: PluginLogger;
	/** Maximum pixel count (width * height) before rejecting the image. @default 100_000_000 */
	maxPixels?: number;
}

/**
 * Creates a beforeChange hook that processes image uploads:
 * - Detects dimensions (width/height)
 * - Generates size variants and stores them
 * - Populates the `sizes` field
 */
export function createImageProcessingHook(options: HookOptions): HookFunction {
	const { processor, adapter, imageSizes, formatPreference = 'original' } = options;

	return async ({ data }) => {
		if (!data) return;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
		const file = data['_file'] as UploadedFile | undefined;

		// Always strip _file — it's transient and must not reach the DB adapter
		const { _file: _stripped, ...cleanData } = data;

		if (!file?.buffer || !isProcessableImage(file.buffer, file.mimeType)) {
			return cleanData; // strip _file even for non-images
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
		const focalPoint = data['focalPoint'] as { x: number; y: number } | undefined;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
		const originalPath = (data['path'] as string) ?? file.originalName;

		// 1. Get dimensions — if the image can't be decoded (e.g., valid magic bytes
		//    but no actual image data), treat it as non-processable
		let dims: Awaited<ReturnType<typeof processor.getDimensions>>;
		try {
			dims = await processor.getDimensions(file.buffer, file.mimeType);
		} catch (err) {
			if (options.logger) {
				options.logger.warn('Image dimensions could not be read — skipping processing:', err);
			}
			return cleanData;
		}

		// 2. Guard against decompression bombs
		const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
		const pixelCount = dims.width * dims.height;
		if (pixelCount > maxPixels) {
			throw new Error(
				`Image dimensions ${dims.width}x${dims.height} (${pixelCount} pixels) exceed safe processing limit of ${maxPixels} pixels`,
			);
		}

		// 3. Process each size variant
		const sizes: Record<string, Record<string, unknown>> = {};

		for (const sizeConfig of imageSizes) {
			const resolvedFormat =
				sizeConfig.format ?? (formatPreference !== 'original' ? formatPreference : undefined);

			try {
				const variant = await processor.processVariant(
					file.buffer,
					file.mimeType,
					{ ...sizeConfig, format: resolvedFormat },
					focalPoint,
				);

				const ext = variant.mimeType.split('/')[1] ?? 'bin';
				const variantFilename = buildVariantFilename(originalPath, sizeConfig.name, ext);

				const variantFile: UploadedFile = {
					buffer: variant.buffer,
					mimeType: variant.mimeType,
					originalName: variantFilename,
					size: variant.buffer.length,
				};

				const basename = variantFilename.split('/').pop() ?? '';
				const lastDot = basename.lastIndexOf('.');
				const stored = await adapter.upload(variantFile, {
					filename: lastDot > 0 ? basename.slice(0, lastDot) : basename,
				});

				sizes[sizeConfig.name] = {
					url: stored.url,
					path: stored.path,
					width: variant.width,
					height: variant.height,
					mimeType: variant.mimeType,
					filesize: variant.buffer.length,
				};
			} catch (err) {
				// Log and continue — partial failure does not abort the upload
				if (options.logger) {
					options.logger.error(`Image variant "${sizeConfig.name}" failed:`, err);
				} else {
					console.error(`Image variant "${sizeConfig.name}" failed:`, err);
				}
			}
		}

		return {
			...cleanData,
			width: dims.width,
			height: dims.height,
			sizes,
		};
	};
}

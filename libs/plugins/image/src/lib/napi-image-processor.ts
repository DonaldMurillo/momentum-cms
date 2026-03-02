import type { ImageProcessor, ImageSizeConfig, ImageDimensions } from '@momentumcms/core';
import { calculateCoverCrop } from './crop-calculator';
import { detectImageFormat } from './format-detector';

const FORMAT_TO_MIME: Record<string, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	avif: 'image/avif',
};

/**
 * Image processor implementation using @napi-rs/image (Rust/NAPI).
 * Requires @napi-rs/image as a peer dependency.
 */
export class NapiImageProcessor implements ImageProcessor {
	async getDimensions(buffer: Uint8Array, _mimeType: string): Promise<ImageDimensions> {
		const { Transformer } = await import('@napi-rs/image');
		const t = new Transformer(Buffer.from(buffer));
		const meta = await t.metadata();
		return { width: meta.width, height: meta.height };
	}

	async processVariant(
		buffer: Uint8Array,
		mimeType: string,
		size: ImageSizeConfig,
		focalPoint?: { x: number; y: number },
	): Promise<{ buffer: Uint8Array; width: number; height: number; mimeType: string }> {
		const { Transformer } = await import('@napi-rs/image');

		const src = Buffer.from(buffer);
		const srcMeta = await new Transformer(src).metadata();
		const srcDims = { width: srcMeta.width, height: srcMeta.height };

		const fit = size.fit ?? 'cover';

		// Resolve target dimensions based on fit mode
		let targetW: number;
		let targetH: number;

		if (fit === 'width') {
			targetW = size.width ?? srcDims.width;
			targetH = Math.round(srcDims.height * (targetW / srcDims.width));
		} else if (fit === 'height') {
			targetH = size.height ?? srcDims.height;
			targetW = Math.round(srcDims.width * (targetH / srcDims.height));
		} else if (fit === 'contain') {
			const w = size.width ?? srcDims.width;
			const h = size.height ?? srcDims.height;
			const scale = Math.min(w / srcDims.width, h / srcDims.height);
			targetW = Math.max(1, Math.round(srcDims.width * scale));
			targetH = Math.max(1, Math.round(srcDims.height * scale));
		} else {
			// cover or fill
			targetW =
				size.width ??
				(size.height ? Math.round(srcDims.width * (size.height / srcDims.height)) : srcDims.width);
			targetH =
				size.height ??
				(size.width ? Math.round(srcDims.height * (size.width / srcDims.width)) : srcDims.height);
		}

		// Build the transformer pipeline
		let t = new Transformer(src);

		// For cover fit: crop first, then resize
		if (fit === 'cover' && size.width && size.height) {
			const crop = calculateCoverCrop(srcDims, { width: targetW, height: targetH }, focalPoint);
			t = t.crop(crop.x, crop.y, crop.width, crop.height);
		}

		t.resize(targetW, targetH);

		// Determine output format
		const sourceFormat = detectImageFormat(buffer);
		const outputFormat = size.format ?? sourceFormat ?? 'jpeg';
		const quality = size.quality ?? 80;

		let outBuffer: Buffer;

		switch (outputFormat) {
			case 'webp':
				outBuffer = await t.webp(quality);
				break;
			case 'avif':
				outBuffer = await t.avif({ quality });
				break;
			case 'png':
				outBuffer = await t.png();
				break;
			default:
				outBuffer = await t.jpeg(quality);
				break;
		}

		return {
			buffer: outBuffer,
			width: targetW,
			height: targetH,
			mimeType: FORMAT_TO_MIME[outputFormat] ?? 'image/jpeg',
		};
	}
}

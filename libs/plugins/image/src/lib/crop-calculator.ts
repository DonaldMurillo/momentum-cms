/**
 * Crop region in source image coordinates.
 */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Calculate the crop rectangle for a "cover" fit.
 * Scales the source to fully cover the target dimensions, then crops
 * centered on the focal point (defaulting to center).
 *
 * All returned values are in source pixel coordinates (integers).
 */
export function calculateCoverCrop(
	source: { width: number; height: number },
	target: { width: number; height: number },
	focalPoint?: { x: number; y: number },
): CropRect {
	const fp = focalPoint ?? { x: 0.5, y: 0.5 };

	// Scale factor to cover the target in both dimensions
	const scale = Math.max(target.width / source.width, target.height / source.height);

	// Crop dimensions in source coordinates
	const cropW = Math.round(target.width / scale);
	const cropH = Math.round(target.height / scale);

	// Focal point position in source coordinates
	const focalX = fp.x * source.width;
	const focalY = fp.y * source.height;

	// Position crop window centered on focal point, then clamp
	let x = Math.round(focalX - cropW / 2);
	let y = Math.round(focalY - cropH / 2);

	// Clamp to source bounds
	x = Math.max(0, Math.min(x, source.width - cropW));
	y = Math.max(0, Math.min(y, source.height - cropH));

	return { x, y, width: cropW, height: cropH };
}

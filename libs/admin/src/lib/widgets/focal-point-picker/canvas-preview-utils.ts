/**
 * Calculate the crop region for a cover-fit preview.
 * Same math as the server-side crop-calculator, but for browser-side preview.
 */
export function calculatePreviewCrop(
	source: { width: number; height: number },
	target: { width: number; height: number },
	focalPoint?: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
	const fp = focalPoint ?? { x: 0.5, y: 0.5 };
	const scale = Math.max(target.width / source.width, target.height / source.height);

	const cropW = Math.round(target.width / scale);
	const cropH = Math.round(target.height / scale);

	const focalX = fp.x * source.width;
	const focalY = fp.y * source.height;

	let x = Math.round(focalX - cropW / 2);
	let y = Math.round(focalY - cropH / 2);

	x = Math.max(0, Math.min(x, source.width - cropW));
	y = Math.max(0, Math.min(y, source.height - cropH));

	return { x, y, width: cropW, height: cropH };
}

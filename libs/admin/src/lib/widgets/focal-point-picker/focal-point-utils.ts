/**
 * Normalize a click position within a container to a 0-1 focal point.
 */
export function normalizeFocalPoint(
	click: { x: number; y: number },
	container: { width: number; height: number },
): { x: number; y: number } {
	return clampFocalPoint({
		x: click.x / container.width,
		y: click.y / container.height,
	});
}

/**
 * Clamp a focal point to the valid 0-1 range on both axes.
 */
export function clampFocalPoint(point: { x: number; y: number }): { x: number; y: number } {
	return {
		x: Math.max(0, Math.min(1, point.x)),
		y: Math.max(0, Math.min(1, point.y)),
	};
}

/**
 * Convert a normalized focal point to a CSS `object-position` string.
 *
 * @example focalPointToCssPosition({ x: 0.25, y: 0.75 }) → '25% 75%'
 */
export function focalPointToCssPosition(point?: { x: number; y: number }): string {
	const fp = point ?? { x: 0.5, y: 0.5 };
	return `${Math.round(fp.x * 100)}% ${Math.round(fp.y * 100)}%`;
}

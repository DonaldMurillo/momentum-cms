/**
 * Shared Type Guards
 *
 * Common type guard functions used across the analytics plugin.
 */

/**
 * Check if a value is a non-null, non-array object.
 */
export function isRecord(val: unknown): val is Record<string, unknown> {
	return val != null && typeof val === 'object' && !Array.isArray(val);
}

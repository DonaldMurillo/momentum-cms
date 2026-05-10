/**
 * Parse a query-string integer that must be a finite, strictly-positive
 * value. Returns `undefined` for missing, malformed, zero, negative, or
 * non-finite inputs so callers can apply defaulting / clamping logic.
 *
 * Used by the NestJS controllers that surface `?limit=` / `?page=` style
 * query params, mirroring the validation done by the Express adapter.
 */
export function parsePositiveInt(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

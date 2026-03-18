/**
 * API Utility Functions
 *
 * Small helpers used by the Momentum API implementation.
 */

/**
 * Recursively compares two values for structural equality.
 * Used by matchesDefaultWhereConstraints to support non-primitive constraint values
 * (arrays, objects) that would fail with strict === reference equality.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (typeof a !== 'object' || typeof b !== 'object') return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}

	if (Array.isArray(b)) return false;

	// Both a and b are non-null, non-array objects at this point
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;

	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed to non-null object, indexing by string key
	const aRec = a as Record<string, unknown>;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed to non-null object, indexing by string key
	const bRec = b as Record<string, unknown>;
	return aKeys.every(
		(key) => Object.prototype.hasOwnProperty.call(bRec, key) && deepEqual(aRec[key], bRec[key]),
	);
}

/**
 * Strip transient keys (prefixed with _) from data before DB persistence.
 * Hooks use _-prefixed keys for inter-hook communication (e.g., _file for upload buffers).
 */
export function stripTransientKeys(data: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (!key.startsWith('_')) {
			result[key] = value;
		}
	}
	return result;
}

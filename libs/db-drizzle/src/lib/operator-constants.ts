/**
 * Shared operator constants and utilities used by both SQLite and PostgreSQL adapters.
 *
 * These are the `$`-prefixed internal operator names that database adapters recognise.
 * User-facing operator names (e.g., `not_equals`) are converted to these by
 * `flattenWhereClause` in `@momentumcms/server-core`.
 */

/** Simple operators that map directly to `"column" OP placeholder` */
export const SIMPLE_OP_MAP: Record<string, string> = {
	$eq: '=',
	$gt: '>',
	$gte: '>=',
	$lt: '<',
	$lte: '<=',
	$ne: '!=',
	$like: 'LIKE',
};

/** All recognised $-prefixed operator keys (simple + special-cased) */
export const ALL_OPS = new Set([
	...Object.keys(SIMPLE_OP_MAP),
	'$contains',
	'$in',
	'$nin',
	'$exists',
]);

/** Maximum number of elements allowed in $in / $nin arrays. */
export const MAX_IN_ARRAY_SIZE = 500;

/** Maximum string length for $like / $contains pattern values. */
export const MAX_PATTERN_LENGTH = 1000;

/** Checks whether an object value contains any recognised operator keys. */
export function hasOperatorKeys(value: object): boolean {
	return Object.keys(value).some((k) => ALL_OPS.has(k));
}

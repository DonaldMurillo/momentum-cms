/**
 * Sanitization utilities for email block rendering.
 *
 * These functions sanitize values before they are interpolated into
 * HTML attributes and CSS style values. Content fields (text, labels, URLs)
 * are escaped via `escapeHtml()`, but style/layout fields need different
 * treatment: whitelisting for enums, stripping for CSS values, numeric
 * parsing for dimensions.
 */

const VALID_ALIGNMENTS = new Set(['left', 'center', 'right']);

/**
 * Whitelist valid text alignment values.
 * Returns 'left' for any value not in the allowed set.
 */
export function sanitizeAlignment(value: string): string {
	return VALID_ALIGNMENTS.has(value) ? value : 'left';
}

/**
 * Sanitize a CSS value by stripping characters that could enable
 * CSS injection, HTML breakout, or url() tracking pixel injection.
 *
 * Strips: ; { } ( ) " ' < > \
 */
export function sanitizeCssValue(value: string): string {
	return value.replace(/[;{}()"'<>\\]/g, '');
}

/**
 * Sanitize a numeric CSS value (e.g., fontSize, height).
 * Parses as a finite non-negative number; returns the fallback string if invalid.
 */
export function sanitizeCssNumber(value: unknown, fallback: number): string {
	if (value === null || value === undefined) return String(fallback);
	const num = Number(value);
	return Number.isFinite(num) && num >= 0 ? String(num) : String(fallback);
}

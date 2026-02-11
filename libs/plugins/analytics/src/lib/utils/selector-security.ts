/**
 * CSS Selector Security Utilities
 *
 * Shared blocklist and validation for tracking rule CSS selectors.
 * Used by both the server-side endpoint (tracking-rules-endpoint.ts)
 * and the client-side rule engine (rule-engine.ts).
 *
 * Selectors targeting sensitive form inputs are rejected to prevent
 * data exfiltration via the tracking rules system.
 */

/**
 * Selectors that could target sensitive form inputs.
 * Checked against the *normalized* selector string (after CSS escape decoding).
 */
const BLOCKED_SELECTOR_PATTERNS: RegExp[] = [
	/type\s*=\s*["']?password/i,
	/type\s*=\s*["']?hidden/i,
	/autocomplete\s*=\s*["']?cc-/i,
	/autocomplete\s*=\s*["']?current-password/i,
	/autocomplete\s*=\s*["']?new-password/i,
];

/**
 * Decode CSS escape sequences in a selector string.
 *
 * CSS allows two forms of escapes (CSS Syntax Level 3, §4.3.7):
 * 1. Hex escapes: `\HH` through `\HHHHHH` (1–6 hex digits) + optional whitespace
 * 2. Character escapes: `\<non-hex-char>` resolves to the literal character
 *
 * Without normalization, an attacker can write `[type=\70assword]` (hex) or
 * `[type=\password]` (character escape) to bypass regex blocklist checks.
 *
 * @see https://www.w3.org/TR/css-syntax-3/#consume-escaped-code-point
 */
function normalizeCssEscapes(selector: string): string {
	return (
		selector
			// 1. Hex escapes: \HH … \HHHHHH followed by optional whitespace
			.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
				String.fromCodePoint(parseInt(hex, 16)),
			)
			// 2. Character escapes: \<non-hex-char> → literal char (e.g. \p → p)
			.replace(/\\([^0-9a-fA-F\n])/g, '$1')
	);
}

/**
 * Strip CSS pseudo-class wrappers that could hide blocked selectors.
 * e.g. `:is([type=password])` → `([type=password])`
 */
function stripPseudoWrappers(selector: string): string {
	return selector.replace(/:(is|where|not|has|matches)\s*\(/gi, '(');
}

/**
 * Check if a CSS selector targets sensitive elements.
 * Normalizes CSS escape sequences and strips pseudo-class wrappers
 * before checking against the blocklist to prevent bypass.
 */
export function isSelectorBlocked(selector: string): boolean {
	const normalized = stripPseudoWrappers(normalizeCssEscapes(selector));
	return BLOCKED_SELECTOR_PATTERNS.some((pattern) => pattern.test(normalized));
}

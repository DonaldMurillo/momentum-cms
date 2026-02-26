/**
 * Escape HTML special characters to prevent XSS in email templates.
 *
 * Use this for values interpolated into raw HTML strings (e.g., plain-text
 * email generation). Angular's template binding already escapes interpolation,
 * so this is primarily needed for non-template contexts.
 */
export function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Shared server utilities used by both Express and Analog server adapters.
 * Extracted to avoid duplication between server-express and server-analog.
 */

/**
 * Sanitize error messages to prevent leaking internal details (SQL, file paths, etc.).
 * Returns the original message if it appears safe, otherwise returns the fallback.
 */
export function sanitizeErrorMessage(error: unknown, fallback: string): string {
	if (!(error instanceof Error)) return fallback;
	const msg = error.message;
	// Strip messages that look like they contain SQL keywords
	if (/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bFROM\b|\bWHERE\b/i.test(msg)) return fallback;
	// Strip messages that contain file paths (Unix forward-slash or Windows backslash)
	if (/[/\\][\w.-]+[/\\][\w.-]+/.test(msg)) return fallback;
	// Strip messages that look like stack traces
	if (msg.includes('at ') && msg.includes('.js:')) return fallback;
	return msg;
}

/**
 * Sanitize a filename for use in Content-Disposition headers.
 * Strips any characters that could enable header injection.
 */
export function sanitizeFilename(name: string): string {
	return name.replace(/[^\w.-]/g, '');
}

/**
 * Parses the `where` query parameter.
 * Handles both JSON string format (?where={"slug":{"equals":"home"}})
 * and pre-parsed object format from h3/qs/Express.
 */
export function parseWhereParam(raw: unknown): Record<string, unknown> | undefined {
	if (typeof raw === 'string') {
		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	}
	if (typeof raw === 'object' && raw !== null) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- qs parsed object
		return raw as Record<string, unknown>;
	}
	return undefined;
}

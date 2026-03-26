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
			const normalized = normalizeWhereOperators(JSON.parse(raw));
			return isRecord(normalized) ? normalized : undefined;
		} catch {
			return undefined;
		}
	}
	if (typeof raw === 'object' && raw !== null) {
		const normalized = normalizeWhereOperators(raw);
		return isRecord(normalized) ? normalized : undefined;
	}
	return undefined;
}

function normalizeWhereOperators(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeWhereOperators(item));
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const normalized: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		const normalizedEntry = normalizeWhereOperators(entry);

		// qs parses ?where[field][in]=value as a scalar, but the adapters require arrays.
		// Only wrap primitives — reject objects to prevent crafted query injection.
		if ((key === 'in' || key === 'not_in') && !Array.isArray(normalizedEntry)) {
			if (normalizedEntry !== null && typeof normalizedEntry === 'object') {
				continue;
			}
			normalized[key] = [normalizedEntry];
			continue;
		}

		normalized[key] = normalizedEntry;
	}

	return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

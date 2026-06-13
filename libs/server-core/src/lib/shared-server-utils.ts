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
	// Strip messages that look like they contain SQL statements
	// Require SQL-like context (keyword combinations with column/table syntax)
	// rather than standalone keywords to avoid false positives on natural language
	// like "select your option from the list"
	if (/\bSELECT\s+[*\w"']+(?:\s*,\s*[*\w"']+)*\s+FROM\b/i.test(msg)) return fallback;
	if (/\bINSERT\s+INTO\b/i.test(msg)) return fallback;
	if (/\bUPDATE\s+["'\w.]+\s+SET\b/i.test(msg)) return fallback;
	if (/\bDELETE\s+FROM\b/i.test(msg)) return fallback;
	if (/\bDROP\s+TABLE\b/i.test(msg)) return fallback;
	if (/\bsyntax error at or near\b/i.test(msg)) return fallback;
	if (/\b(?:column|relation|table)\s+["'\w.-]+(?:\s+\w+)*\s+does not exist\b/i.test(msg)) {
		return fallback;
	}
	if (/\bcolumn\s+["'\w.-]+(?:\s+\w+)*\s+referenced\b/i.test(msg)) return fallback;
	if (/\bviolates\s+(?:foreign key|unique|not-null|check)\s+constraint\b/i.test(msg)) {
		return fallback;
	}
	// Strip messages that contain file paths (Unix forward-slash or Windows backslash).
	// Remove URLs first so public documentation URLs (e.g. https://schema.org/Article)
	// don't false-positive, while STILL catching real filesystem paths elsewhere in the
	// same message. Disabling the path check whenever any URL is present (the previous
	// approach) let a message like `open '/etc/secret' (see https://x.com)` leak the path.
	const msgWithoutUrls = msg.replace(/https?:\/\/\S+/gi, '');
	if (/[/\\][\w.-]+[/\\][\w.-]+/.test(msgWithoutUrls)) return fallback;
	// Strip messages that look like stack traces
	if (msg.includes('at ') && msg.includes('.js:')) return fallback;
	// Strip network errors leaking hostnames, IPs, and ports
	if (/\bECONNREFUSED\b/i.test(msg)) return fallback;
	if (/\bECONNRESET\b/i.test(msg)) return fallback;
	if (/\bETIMEDOUT\b/i.test(msg)) return fallback;
	if (/\bENOTFOUND\b/i.test(msg)) return fallback;
	if (/\bEHOSTUNREACH\b/i.test(msg)) return fallback;
	if (/\bgetaddrinfo\b/i.test(msg)) return fallback;
	// Internal URLs: localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
	// Also catch any URL appearing alongside error keywords like "connect", "fetch", "request"
	if (/https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(msg))
		return fallback;
	if (/\b(?:connect|fetch|request|socket)\b.*https?:\/\//i.test(msg)) return fallback;
	if (/https?:\/\/[\w.-]+:\d+/.test(msg)) return fallback;
	// IP:port patterns (IPv4 only — IPv6 caught by :: patterns above)
	if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(msg)) return fallback;
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
		// Objects can arise from crafted query injection (e.g., ?where[status][in]=foo parsed as {0:"foo"})
		// Convert objects to their values array so the filter is preserved rather than silently dropped.
		if ((key === 'in' || key === 'not_in') && !Array.isArray(normalizedEntry)) {
			if (normalizedEntry !== null && typeof normalizedEntry === 'object') {
				const values = Object.values(normalizedEntry);
				// Always set the key — even for empty objects. An empty `in` array
				// means "match nothing" (correct), whereas silently dropping the key
				// means "match everything" (data leak).
				normalized[key] = values;
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

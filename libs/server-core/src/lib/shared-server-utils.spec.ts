import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage, parseWhereParam, sanitizeFilename } from './shared-server-utils';

describe('sanitizeErrorMessage', () => {
	// --- SQL keyword detection ---
	it('returns fallback for messages containing SELECT...FROM pattern', () => {
		const err = new Error('error: SELECT "id" FROM "users" WHERE ...');
		expect(sanitizeErrorMessage(err, 'Something went wrong')).toBe('Something went wrong');
	});

	it('returns fallback for messages containing INSERT INTO pattern', () => {
		const err = new Error('INSERT INTO "articles" ("title") VALUES ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing UPDATE...SET pattern', () => {
		const err = new Error('error near UPDATE "posts" SET ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing DELETE FROM pattern', () => {
		const err = new Error('DELETE FROM "sessions" WHERE ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	// --- File path detection ---
	it('returns fallback for Unix file paths', () => {
		const err = new Error('ENOENT: no such file /usr/local/app/config.json');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for deep Unix paths', () => {
		const err = new Error('Cannot read /home/deploy/momentum-cms/data/uploads/file.png');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for Windows file paths', () => {
		const err = new Error('ENOENT: no such file C:\\Users\\Admin\\AppData\\config.json');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for paths with numeric segments', () => {
		const err = new Error('Cannot find module /opt/app-2024/node_modules/drizzle');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for paths with dots in segments', () => {
		const err = new Error('Error reading /var/log/app.v2/errors.log');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	// --- Stack trace detection ---
	it('returns fallback for stack trace lines', () => {
		const err = new Error('at Object.<anonymous> (/app/server.js:42)');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for stack traces with .js: pattern', () => {
		const err = new Error('TypeError at module.js:123 — cannot read property');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	// --- Casual SQL-like words in natural language (Fix A) ---
	it('allows messages with casual SQL-like words in natural language', () => {
		const err = new Error('Please select your preferred option from the list');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe(
			'Please select your preferred option from the list',
		);
	});

	it('allows messages with standalone word "from" in natural language', () => {
		const err = new Error('copied from another document');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('copied from another document');
	});

	it('allows messages with standalone word "where" in natural language', () => {
		const err = new Error('show me where the error is');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('show me where the error is');
	});

	// --- Actual SQL injection patterns are still blocked (Fix A) ---
	it('blocks messages containing SELECT ... FROM SQL injection patterns', () => {
		const err = new Error('SELECT * FROM users WHERE id = 1');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks messages containing INSERT INTO SQL patterns', () => {
		const err = new Error('INSERT INTO "articles" ("title") VALUES ...');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks messages containing UPDATE ... SET SQL patterns', () => {
		const err = new Error('error near UPDATE "posts" SET ...');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks messages containing DELETE FROM SQL patterns', () => {
		const err = new Error('DELETE FROM "sessions" WHERE ...');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks messages containing DROP TABLE SQL patterns', () => {
		const err = new Error('DROP TABLE "users"');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks database parser errors that mention SQL clauses', () => {
		const err = new Error('syntax error at or near "WHERE"');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('blocks database column/relation errors', () => {
		const columnErr = new Error('column "secret_token" does not exist');
		const relationErr = new Error('relation "auth_sessions" does not exist');

		expect(sanitizeErrorMessage(columnErr, 'fallback')).toBe('fallback');
		expect(sanitizeErrorMessage(relationErr, 'fallback')).toBe('fallback');
	});

	// --- Safe messages pass through ---
	it('returns original message for safe error messages', () => {
		const err = new Error('Document not found');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('Document not found');
	});

	it('returns original message for validation errors', () => {
		const err = new Error('Field "title" is required');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('Field "title" is required');
	});

	it('returns original message for duplicate key errors without SQL', () => {
		const err = new Error('Duplicate value for unique field "slug"');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('Duplicate value for unique field "slug"');
	});

	// --- Non-Error values ---
	it('returns fallback for non-Error values (string)', () => {
		expect(sanitizeErrorMessage('a string error', 'fail')).toBe('fail');
	});

	it('returns fallback for non-Error values (null)', () => {
		expect(sanitizeErrorMessage(null, 'fail')).toBe('fail');
	});

	it('returns fallback for non-Error values (undefined)', () => {
		expect(sanitizeErrorMessage(undefined, 'fail')).toBe('fail');
	});

	it('returns fallback for non-Error values (number)', () => {
		expect(sanitizeErrorMessage(42, 'fail')).toBe('fail');
	});

	// --- Hostname / port / network info leaks ---
	it('returns fallback for ECONNREFUSED with host:port', () => {
		const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('returns fallback for messages containing internal URLs', () => {
		const err = new Error('fetch failed http://db.internal:5432/query');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('returns fallback for DNS resolution errors leaking hostnames', () => {
		const err = new Error('getaddrinfo ENOTFOUND db-server.internal.local');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('returns fallback for connection refused with IPv6 loopback', () => {
		const err = new Error('connect ECONNREFUSED ::1:5432');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	// --- Public URLs should NOT be sanitized (false positive protection) ---
	it('preserves messages with public documentation URLs', () => {
		const err = new Error('See https://docs.example.com for API documentation');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe(
			'See https://docs.example.com for API documentation',
		);
	});

	it('preserves messages with public schema URLs (with path segments)', () => {
		const err = new Error('Invalid format, expected https://schema.org/Article');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe(
			'Invalid format, expected https://schema.org/Article',
		);
	});

	it('preserves messages with public schema URLs (no slashes in path)', () => {
		const err = new Error('Please visit https://momentumcms.com for help');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe(
			'Please visit https://momentumcms.com for help',
		);
	});

	// --- A filesystem path must still be stripped even when a public URL is present ---
	it('strips a filesystem path even when the message also contains a public URL', () => {
		// URL presence must not disable path detection — the URL is removed first,
		// then the remaining text is checked for real filesystem paths.
		const err = new Error("open '/etc/app/secret.key' failed, see https://docs.example.com/errors");
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});

	it('strips a Windows path even when the message also contains a public URL', () => {
		const err = new Error('cannot read C:\\app\\config\\secret.env (docs: https://example.com)');
		expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
	});
});

describe('parseWhereParam', () => {
	it('parses valid JSON string', () => {
		const result = parseWhereParam('{"slug":{"equals":"home"}}');
		expect(result).toEqual({ slug: { equals: 'home' } });
	});

	it('parses nested JSON string', () => {
		const result = parseWhereParam(
			'{"and":[{"status":{"equals":"published"}},{"title":{"contains":"test"}}]}',
		);
		expect(result).toEqual({
			and: [{ status: { equals: 'published' } }, { title: { contains: 'test' } }],
		});
	});

	it('returns undefined for invalid JSON string', () => {
		expect(parseWhereParam('not-json')).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(parseWhereParam('')).toBeUndefined();
	});

	it('normalizes JSON string `in` operator scalars into arrays', () => {
		const result = parseWhereParam('{"tags":{"in":"tag-1"}}');
		expect(result).toEqual({ tags: { in: ['tag-1'] } });
	});

	it('normalizes pre-parsed objects (qs bracket notation)', () => {
		const obj = { slug: { equals: 'home' } };
		expect(parseWhereParam(obj)).toEqual(obj);
	});

	it('normalizes bracket-notation `in` operator scalars into arrays', () => {
		const obj = { tags: { in: 'tag-1' } };
		expect(parseWhereParam(obj)).toEqual({ tags: { in: ['tag-1'] } });
	});

	it('normalizes nested logical clauses recursively', () => {
		const obj = {
			or: [{ tags: { in: 'tag-1' } }, { status: { not_in: 'archived' } }],
		};
		expect(parseWhereParam(obj)).toEqual({
			or: [{ tags: { in: ['tag-1'] } }, { status: { not_in: ['archived'] } }],
		});
	});

	it('returns undefined for null', () => {
		expect(parseWhereParam(null)).toBeUndefined();
	});

	it('returns undefined for undefined', () => {
		expect(parseWhereParam(undefined)).toBeUndefined();
	});

	it('returns undefined for numbers', () => {
		expect(parseWhereParam(42)).toBeUndefined();
	});

	it('returns undefined for booleans', () => {
		expect(parseWhereParam(true)).toBeUndefined();
	});

	it('converts object values inside in operator to values array', () => {
		// Simulates crafted query: ?where[status][in][equals]=something
		// qs parses this as {0:"foo"} style objects; normalizeWhereOperators converts
		// object values to Object.values arrays so the filter is preserved.
		const obj = { status: { in: { equals: 'something' } } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { in: ['something'] } });
	});

	it('converts object values inside not_in operator to values array', () => {
		const obj = { status: { not_in: { equals: 'something' } } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { not_in: ['something'] } });
	});

	it('wraps primitive string values in in/not_in as arrays', () => {
		const obj = { tags: { in: 'tag-1' }, status: { not_in: 'archived' } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ tags: { in: ['tag-1'] }, status: { not_in: ['archived'] } });
	});

	it('wraps primitive number values in in/not_in as arrays', () => {
		const obj = { priority: { in: 5 } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ priority: { in: [5] } });
	});

	// --- Regression: qs bracket-notation objects in `in` operator ---
	it('converts qs bracket-notation object {0:"draft"} to array ["draft"]', () => {
		// ?where[status][in][0]=draft → qs parses to {0:"draft"}
		const obj = { status: { in: { '0': 'draft' } } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { in: ['draft'] } });
	});

	it('keeps empty `in` array for empty object (match-nothing, not match-everything)', () => {
		// Empty object → Object.values({}) = [] → must become { in: [] } not dropped.
		// Dropping the key would widen the filter to match all rows (data leak).
		const obj = { status: { in: {} } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { in: [] } });
	});

	it('extracts non-primitive values from qs bracket-notation objects', () => {
		// ?where[status][in][0][nested]=x → qs might parse as {0: {nested: 'x'}}
		const obj = { status: { in: { '0': { nested: 'x' } } } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { in: [{ nested: 'x' }] } });
	});

	it('preserves existing arrays in `in` operator unchanged', () => {
		const obj = { status: { in: ['draft', 'published'] } };
		const result = parseWhereParam(obj);
		expect(result).toEqual({ status: { in: ['draft', 'published'] } });
	});
});

describe('sanitizeFilename', () => {
	it('keeps safe filenames unchanged', () => {
		expect(sanitizeFilename('articles-export.csv')).toBe('articles-export.csv');
	});

	it('keeps filenames with dots and hyphens', () => {
		expect(sanitizeFilename('my-collection.v2.json')).toBe('my-collection.v2.json');
	});

	it('strips path traversal slashes', () => {
		// Dots and word chars are allowed; only slashes are stripped
		expect(sanitizeFilename('../../../etc/passwd')).toBe('......etcpasswd');
	});

	it('strips spaces', () => {
		expect(sanitizeFilename('file name with spaces.csv')).toBe('filenamewithspaces.csv');
	});

	it('strips control characters', () => {
		expect(sanitizeFilename('file\r\ninjection.csv')).toBe('fileinjection.csv');
	});

	it('strips header injection characters', () => {
		expect(sanitizeFilename('file"; malicious-header: value')).toBe('filemalicious-headervalue');
	});

	it('returns empty string for empty input', () => {
		expect(sanitizeFilename('')).toBe('');
	});

	it('handles unicode characters by stripping non-word chars', () => {
		expect(sanitizeFilename('caf\u00e9-menu.json')).toBe('caf-menu.json');
	});
});

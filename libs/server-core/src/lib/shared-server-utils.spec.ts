import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage, parseWhereParam, sanitizeFilename } from './shared-server-utils';

describe('sanitizeErrorMessage', () => {
	// --- SQL keyword detection ---
	it('returns fallback for messages containing SELECT', () => {
		const err = new Error('error: SELECT "id" FROM "users" WHERE ...');
		expect(sanitizeErrorMessage(err, 'Something went wrong')).toBe('Something went wrong');
	});

	it('returns fallback for messages containing INSERT', () => {
		const err = new Error('INSERT INTO "articles" ("title") VALUES ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing UPDATE', () => {
		const err = new Error('error near UPDATE "posts" SET ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing DELETE', () => {
		const err = new Error('DELETE FROM "sessions" WHERE ...');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing FROM clause', () => {
		const err = new Error('column "foo" referenced FROM subquery');
		expect(sanitizeErrorMessage(err, 'fail')).toBe('fail');
	});

	it('returns fallback for messages containing WHERE clause', () => {
		const err = new Error('syntax error at or near WHERE');
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

	it('passes through pre-parsed objects (qs bracket notation)', () => {
		const obj = { slug: { equals: 'home' } };
		expect(parseWhereParam(obj)).toBe(obj);
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

import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Security Hardening E2E Tests.
 *
 * Verifies that API endpoints handle errors securely:
 * - Import errors don't leak internal details or echo submitted data
 * - Export headers are safe from injection
 * - CORS includes Vary: Origin header
 */

test.describe('Security hardening @security @api', { tag: ['@security', '@api'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	// ============================================
	// Import error response safety
	// ============================================
	test.describe('Import error responses do not leak sensitive data', () => {
		test('import with partial failures does not echo back submitted document data', async ({
			request,
		}) => {
			// Import one valid doc and one with missing required "name" field.
			// The invalid one should trigger a per-doc error in the response.
			const response = await request.post('/api/categories/import', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					format: 'json',
					docs: [
						{ name: 'Security Echo Test', slug: `security-echo-test-${Date.now()}` },
						// Missing required "name" field — triggers per-doc validation error
						{ slug: `missing-name-echo-${Date.now()}` },
					],
				},
			});

			// The import should return a result (200 if at least one succeeded, 400 if all failed)
			const body = (await response.json()) as Record<string, unknown>;

			// Verify the response has the expected structure
			expect(body, 'Response should have a "total" field').toHaveProperty('total');
			expect(body, 'Response should have an "errors" field').toHaveProperty('errors');

			const errors = body['errors'] as Array<Record<string, unknown>>;
			expect(Array.isArray(errors), 'errors should be an array').toBe(true);

			// Verify partial failure actually triggered (at least one error)
			expect(
				errors.length,
				'Import should have at least one error for the invalid doc',
			).toBeGreaterThan(0);

			// Errors must NOT contain a "data" property
			// that echoes back the submitted document (prevents reflection attacks)
			for (const err of errors) {
				expect(
					err,
					'Import error must not echo back submitted document via "data" property',
				).not.toHaveProperty('data');
			}

			// Cleanup successfully imported docs

			const docs = (body['docs'] ?? []) as Array<{ id: string }>;
			for (const doc of docs) {
				const delResponse = await request.delete(`/api/categories/${doc.id}`);
				expect(delResponse.ok()).toBe(true);
			}
		});

		test('import error messages are sanitized (no SQL or path leakage)', async ({ request }) => {
			// Import docs that will trigger validation errors
			const response = await request.post('/api/categories/import', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					format: 'json',
					docs: [
						{ name: 'Valid Category', slug: `security-sanitize-${Date.now()}` },
						// Missing required "name" field to trigger validation error
						{ slug: `missing-name-sanitize-${Date.now()}` },
					],
				},
			});

			const body = (await response.json()) as Record<string, unknown>;

			// Verify we got the expected response structure with errors
			expect(body).toHaveProperty('errors');

			const errors = (body['errors'] ?? []) as Array<{ index: number; message: string }>;

			// If there are error messages, verify they don't contain SQL or paths
			const sqlPattern = /SELECT |INSERT |UPDATE |DELETE |FROM |WHERE /i;
			const pathPattern = /[/\\][\w.-]+[/\\][\w.-]+/;

			for (const err of errors) {
				expect(
					sqlPattern.test(err.message),
					`Import error message should not contain SQL keywords: "${err.message}"`,
				).toBe(false);
				expect(
					pathPattern.test(err.message),
					`Import error message should not contain file paths: "${err.message}"`,
				).toBe(false);
			}

			// Cleanup successfully imported docs

			const docs = (body['docs'] ?? []) as Array<{ id: string }>;
			for (const doc of docs) {
				const delResponse = await request.delete(`/api/categories/${doc.id}`);
				expect(delResponse.ok()).toBe(true);
			}
		});
	});

	// ============================================
	// Export Content-Disposition header safety
	// ============================================
	test.describe('Export Content-Disposition headers are injection-safe', () => {
		test('CSV export Content-Disposition filename contains only safe characters', async ({
			request,
		}) => {
			const response = await request.get('/api/categories/export?format=csv');
			expect(response.ok()).toBe(true);

			const disposition = response.headers()['content-disposition'] ?? '';
			expect(disposition).toContain('attachment');

			// Extract filename from header — should only contain word chars, hyphens, dots
			const filenameMatch = disposition.match(/filename="([^"]+)"/);
			expect(filenameMatch, 'Content-Disposition must have a filename').toBeTruthy();
			const filename = filenameMatch?.[1];
			expect(
				/^[\w.-]+$/.test(filename),
				`Filename must contain only safe characters (word chars, dots, hyphens), got: "${filename}"`,
			).toBe(true);
		});

		test('JSON export Content-Disposition filename contains only safe characters', async ({
			request,
		}) => {
			const response = await request.get('/api/categories/export?format=json');
			const disposition = response.headers()['content-disposition'] ?? '';
			expect(disposition).toContain('attachment');

			const filenameMatch = disposition.match(/filename="([^"]+)"/);
			expect(filenameMatch, 'Content-Disposition must have a filename').toBeTruthy();
			const filename = filenameMatch?.[1];
			expect(
				/^[\w.-]+$/.test(filename),
				`Filename must contain only safe characters, got: "${filename}"`,
			).toBe(true);
		});
	});

	// ============================================
	// CORS headers
	// ============================================
	test.describe('CORS headers are present and well-formed', () => {
		test('OPTIONS preflight returns proper CORS headers', async ({ request }) => {
			const response = await request.fetch('/api/articles', {
				method: 'OPTIONS',
				headers: {
					Origin: 'https://external-app.example.com',
					'Access-Control-Request-Method': 'GET',
				},
			});

			const acao = response.headers()['access-control-allow-origin'] ?? '';
			const methods = response.headers()['access-control-allow-methods'] ?? '';
			const headers = response.headers()['access-control-allow-headers'] ?? '';
			const vary = response.headers()['vary'] ?? '';

			// CORS headers must be present
			expect(acao, 'Access-Control-Allow-Origin must be set').toBeTruthy();
			expect(methods, 'Access-Control-Allow-Methods must be set').toBeTruthy();
			expect(headers, 'Access-Control-Allow-Headers must be set').toBeTruthy();

			// Security invariant: if ACAO is a specific origin (not *), Vary: Origin
			// MUST be set to prevent cache poisoning attacks
			if (acao !== '*') {
				expect(
					vary.toLowerCase(),
					'When ACAO is a specific origin, Vary: Origin must be set to prevent cache poisoning',
				).toContain('origin');
			}
		});

		test('Regular API response returns CORS headers when Origin is sent', async ({ request }) => {
			const response = await request.fetch('/api/articles', {
				method: 'GET',
				headers: {
					Origin: 'https://external-app.example.com',
				},
			});

			const acao = response.headers()['access-control-allow-origin'] ?? '';
			const vary = response.headers()['vary'] ?? '';

			// CORS header must be present
			expect(acao, 'Access-Control-Allow-Origin must be set').toBeTruthy();

			// Security invariant: dynamic origin requires Vary header
			if (acao !== '*') {
				expect(
					vary.toLowerCase(),
					'When ACAO is a specific origin, Vary: Origin must be set to prevent cache poisoning',
				).toContain('origin');
			}
		});
	});
});

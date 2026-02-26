import { test, expect, TEST_CREDENTIALS } from '../fixtures';

// Configure ALL tests in this file to run serially (shared state across tests)
test.describe.configure({ mode: 'serial' });

test.describe('Route handler security', { tag: ['@security', '@api'] }, () => {
	test.beforeAll(async ({ request }) => {
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
	// CORS: X-API-Key must be in Access-Control-Allow-Headers
	// ============================================
	test.describe('CORS preflight allows X-API-Key header', () => {
		test('OPTIONS preflight includes X-API-Key in Access-Control-Allow-Headers', async ({
			request,
		}) => {
			const response = await request.fetch('/api/articles', {
				method: 'OPTIONS',
				headers: {
					Origin: 'https://external-app.example.com',
					'Access-Control-Request-Method': 'GET',
					'Access-Control-Request-Headers': 'X-API-Key',
				},
			});

			const allowHeaders = response.headers()['access-control-allow-headers'] ?? '';
			expect(
				allowHeaders.toLowerCase(),
				'CORS Access-Control-Allow-Headers must include x-api-key for cross-origin API key auth',
			).toContain('x-api-key');
		});

		test('OPTIONS preflight still allows Content-Type and Authorization', async ({ request }) => {
			const response = await request.fetch('/api/articles', {
				method: 'OPTIONS',
				headers: {
					Origin: 'https://external-app.example.com',
					'Access-Control-Request-Method': 'POST',
					'Access-Control-Request-Headers': 'Content-Type, Authorization',
				},
			});

			const allowHeaders = response.headers()['access-control-allow-headers'] ?? '';
			expect(allowHeaders.toLowerCase()).toContain('content-type');
			expect(allowHeaders.toLowerCase()).toContain('authorization');
		});
	});

	// ============================================
	// Bug #1: Unknown POST actions should return 404
	// ============================================
	test.describe('Unknown POST actions return 404', () => {
		let articleId: string;

		test('setup: create article for action tests', async ({ request }) => {
			const response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Security Test Article ${Date.now()}`,
					content: '<p>Test content for unknown action tests</p>',
				},
			});
			expect(response.status()).toBe(201);
			const data = (await response.json()) as { doc: { id: string } };
			articleId = data.doc.id;
		});

		test('POST /:collection/:id/nonexistent-action returns 404', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleId}/nonexistent-action`, {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
			expect(response.status()).toBe(404);
		});

		test('POST /:collection/:id/garbage returns 404', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleId}/garbage`, {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
			expect(response.status()).toBe(404);
		});

		test('known action (publish) still works', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleId}/publish`);
			expect(response.ok()).toBe(true);
		});

		test('cleanup: delete test article', async ({ request }) => {
			if (articleId) {
				const response = await request.delete(`/api/articles/${articleId}`);
				expect(response.ok()).toBe(true);
			}
		});
	});

	// ============================================
	// Bug #3: Version restore must validate docId
	// ============================================
	test.describe('Version restore validates document ownership', () => {
		let articleAId: string;
		let articleBId: string;
		let articleAVersionId: string;

		test('setup: create article A', async ({ request }) => {
			const response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Article A ${Date.now()}`,
					content: '<p>Article A content</p>',
				},
			});
			expect(response.status()).toBe(201);
			const data = (await response.json()) as { doc: { id: string } };
			articleAId = data.doc.id;
		});

		test('setup: create article B', async ({ request }) => {
			const response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Article B ${Date.now()}`,
					content: '<p>Article B content</p>',
				},
			});
			expect(response.status()).toBe(201);
			const data = (await response.json()) as { doc: { id: string } };
			articleBId = data.doc.id;
		});

		test('setup: publish article A to create a version', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleAId}/publish`);
			expect(response.ok()).toBe(true);
		});

		test('setup: get article A version ID', async ({ request }) => {
			const response = await request.get(`/api/articles/${articleAId}/versions`);
			expect(response.ok()).toBe(true);
			const data = (await response.json()) as {
				docs: Array<{ id: string; parent: string }>;
			};
			expect(data.docs.length).toBeGreaterThan(0);
			// Find a non-autosave version
			const version = data.docs.find((v: Record<string, unknown>) => !v['autosave']);
			expect(version, 'Should have a non-autosave version').toBeDefined();
			articleAVersionId = version?.id;
		});

		test('restoring article A version on article B URL should fail (400)', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleBId}/versions/restore`, {
				headers: { 'Content-Type': 'application/json' },
				data: { versionId: articleAVersionId },
			});
			// Cross-document restore must be rejected
			expect(response.status()).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toContain('mismatch');
		});

		test('restoring article A version on article A URL should succeed', async ({ request }) => {
			const response = await request.post(`/api/articles/${articleAId}/versions/restore`, {
				headers: { 'Content-Type': 'application/json' },
				data: { versionId: articleAVersionId },
			});
			expect(response.ok()).toBe(true);
			const data = (await response.json()) as { doc: Record<string, unknown>; message: string };
			expect(data.message).toBe('Version restored successfully');
		});

		test('cleanup: delete test articles', async ({ request }) => {
			if (articleAId) {
				const responseA = await request.delete(`/api/articles/${articleAId}`);
				expect(responseA.ok()).toBe(true);
			}
			if (articleBId) {
				const responseB = await request.delete(`/api/articles/${articleBId}`);
				expect(responseB.ok()).toBe(true);
			}
		});
	});
});

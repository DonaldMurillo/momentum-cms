import { test, expect } from '@playwright/test';

/**
 * API Endpoint Tests (Unauthenticated)
 *
 * These tests verify API behavior for unauthenticated requests.
 * With access control enabled:
 * - Posts: public read, authenticated create/update, admin delete
 * - Users: admin-only for all operations
 *
 * Authenticated API operations are tested in access-control.spec.ts
 */

test.describe('API Endpoints - Posts Collection (Unauthenticated)', () => {
	test('GET /api/posts should return array of documents (public read)', async ({ request }) => {
		const response = await request.get('/api/posts');

		expect(response.status()).toBe(200);
		const body = await response.json();
		// In-memory DB may have documents from parallel tests, just verify structure
		expect(Array.isArray(body.docs)).toBe(true);
		expect(typeof body.totalDocs).toBe('number');
	});

	test('POST /api/posts should deny unauthenticated create', async ({ request }) => {
		const response = await request.post('/api/posts', {
			data: {
				title: 'E2E Test Post',
				slug: 'e2e-test-post',
				content: 'This is content from E2E test',
				status: 'draft',
			},
		});

		// Access control: create requires authentication
		expect(response.status()).toBe(403);
	});

	test('GET /api/posts/:id should return 404 for nonexistent post', async ({ request }) => {
		const response = await request.get('/api/posts/nonexistent-id');

		expect(response.status()).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('Document not found');
	});

	test('PATCH /api/posts/:id should deny unauthenticated update', async ({ request }) => {
		const response = await request.patch('/api/posts/some-id', {
			data: {
				title: 'Updated Title',
			},
		});

		// Access control: update requires authentication
		expect(response.status()).toBe(403);
	});

	test('DELETE /api/posts/:id should deny unauthenticated delete', async ({ request }) => {
		const response = await request.delete('/api/posts/some-id');

		// Access control: delete requires admin
		expect(response.status()).toBe(403);
	});
});

test.describe('API Endpoints - Users Collection (Unauthenticated)', () => {
	test('GET /api/users should deny unauthenticated read', async ({ request }) => {
		const response = await request.get('/api/users');

		// Access control: users read requires admin
		expect(response.status()).toBe(403);
	});

	test('POST /api/users should deny unauthenticated create', async ({ request }) => {
		const response = await request.post('/api/users', {
			data: {
				name: 'John Doe',
				email: 'john@example.com',
				role: 'admin',
				active: true,
			},
		});

		// Access control: users create requires admin
		expect(response.status()).toBe(403);
	});
});

test.describe('API Endpoints - Error Handling', () => {
	test('GET /api/unknown should return 404 for unknown collection', async ({ request }) => {
		const response = await request.get('/api/unknown');

		expect(response.status()).toBe(404);
		const body = await response.json();
		expect(body.error).toContain('not found');
	});
});

test.describe('API CORS Headers', () => {
	test('API should return CORS headers', async ({ request }) => {
		const response = await request.get('/api/posts');

		expect(response.headers()['access-control-allow-origin']).toBe('*');
	});
});

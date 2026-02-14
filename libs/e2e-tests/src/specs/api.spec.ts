import { test, expect } from '../fixtures';

/**
 * API Endpoint Tests (Unauthenticated)
 *
 * These tests verify API behavior for unauthenticated requests.
 * With access control enabled:
 * - Categories: public access (allowAll)
 * - User Notes: authenticated users only
 * - Auth Users: admin-only for all operations
 *
 * Authenticated API operations are tested in access-control.spec.ts
 */

test.describe('API Endpoints - Categories Collection (Unauthenticated)', () => {
	test('GET /api/categories should return array of documents (public read)', async ({
		request,
	}) => {
		const response = await request.get('/api/categories');

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body.docs)).toBe(true);
		expect(typeof body.totalDocs).toBe('number');
	});

	test('GET /api/categories/:id should return 404 for nonexistent document', async ({
		request,
	}) => {
		const response = await request.get('/api/categories/nonexistent-id');

		expect(response.status()).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('Document not found');
	});
});

test.describe('API Endpoints - User Notes Collection (Unauthenticated)', () => {
	test('GET /api/user-notes should deny unauthenticated read', async ({ request }) => {
		const response = await request.get('/api/user-notes');

		// Access control: user-notes read requires authentication
		expect(response.status()).toBe(403);
	});

	test('POST /api/user-notes should deny unauthenticated create', async ({ request }) => {
		const response = await request.post('/api/user-notes', {
			data: {
				title: 'E2E Test Note',
				content: 'This is content from E2E test',
			},
		});

		// Access control: create requires authentication
		expect(response.status()).toBe(403);
	});

	test('PATCH /api/user-notes/:id should deny unauthenticated update', async ({ request }) => {
		const response = await request.patch('/api/user-notes/some-id', {
			data: {
				title: 'Updated Title',
			},
		});

		// Access control: update requires authentication
		expect(response.status()).toBe(403);
	});

	test('DELETE /api/user-notes/:id should deny unauthenticated delete', async ({ request }) => {
		const response = await request.delete('/api/user-notes/some-id');

		// Access control: delete requires authentication
		expect(response.status()).toBe(403);
	});
});

test.describe('API Endpoints - Auth Users Collection (Unauthenticated)', () => {
	test('GET /api/auth-user should deny unauthenticated read', async ({ request }) => {
		const response = await request.get('/api/auth-user');

		// Access control: users read requires admin
		expect(response.status()).toBe(403);
	});

	test('POST /api/auth-user should deny unauthenticated create', async ({ request }) => {
		const response = await request.post('/api/auth-user', {
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
		const response = await request.get('/api/categories');

		expect(response.headers()['access-control-allow-origin']).toBe('*');
	});
});

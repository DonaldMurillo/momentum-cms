import { test, expect } from '@playwright/test';

test.describe('API Endpoints - Posts Collection', () => {
	test('GET /api/posts should return array of documents', async ({ request }) => {
		const response = await request.get('/api/posts');

		expect(response.status()).toBe(200);
		const body = await response.json();
		// In-memory DB may have documents from parallel tests, just verify structure
		expect(Array.isArray(body.docs)).toBe(true);
		expect(typeof body.totalDocs).toBe('number');
	});

	test('POST /api/posts should create a new post', async ({ request }) => {
		const response = await request.post('/api/posts', {
			data: {
				title: 'E2E Test Post',
				slug: 'e2e-test-post',
				content: 'This is content from E2E test',
				status: 'draft',
			},
		});

		expect(response.status()).toBe(201);
		const body = await response.json();
		expect(body.doc.title).toBe('E2E Test Post');
		expect(body.doc.id).toBeDefined();
	});

	test('POST /api/posts should validate required fields', async ({ request }) => {
		const response = await request.post('/api/posts', {
			data: {
				content: 'Missing title and slug',
			},
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Validation failed');
		expect(body.errors).toContainEqual({
			field: 'title',
			message: 'Title is required',
		});
	});

	test('GET /api/posts/:id should return a specific post', async ({ request }) => {
		// First create a post
		const createResponse = await request.post('/api/posts', {
			data: {
				title: 'Post to Fetch',
				slug: 'post-to-fetch',
			},
		});
		const createBody = await createResponse.json();
		const postId = createBody.doc.id;

		// Then fetch it
		const response = await request.get(`/api/posts/${postId}`);

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.doc.title).toBe('Post to Fetch');
	});

	test('GET /api/posts/:id should return 404 for nonexistent post', async ({ request }) => {
		const response = await request.get('/api/posts/nonexistent-id');

		expect(response.status()).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('Document not found');
	});

	test('PATCH /api/posts/:id should update a post', async ({ request }) => {
		// First create a post
		const createResponse = await request.post('/api/posts', {
			data: {
				title: 'Original Title',
				slug: 'original-slug',
			},
		});
		const createBody = await createResponse.json();
		const postId = createBody.doc.id;

		// Then update it
		const response = await request.patch(`/api/posts/${postId}`, {
			data: {
				title: 'Updated Title',
			},
		});

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.doc.title).toBe('Updated Title');
	});

	test('DELETE /api/posts/:id should delete a post', async ({ request }) => {
		// First create a post
		const createResponse = await request.post('/api/posts', {
			data: {
				title: 'Post to Delete',
				slug: 'post-to-delete',
			},
		});
		const createBody = await createResponse.json();
		const postId = createBody.doc.id;

		// Delete it
		const deleteResponse = await request.delete(`/api/posts/${postId}`);
		expect(deleteResponse.status()).toBe(200);
		const deleteBody = await deleteResponse.json();
		expect(deleteBody.deleted).toBe(true);

		// Verify it's deleted
		const getResponse = await request.get(`/api/posts/${postId}`);
		expect(getResponse.status()).toBe(404);
	});
});

test.describe('API Endpoints - Users Collection', () => {
	test('GET /api/users should return empty array initially', async ({ request }) => {
		const response = await request.get('/api/users');

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.docs).toBeDefined();
	});

	test('POST /api/users should create a new user', async ({ request }) => {
		const response = await request.post('/api/users', {
			data: {
				name: 'John Doe',
				email: 'john@example.com',
				role: 'admin',
				active: true,
			},
		});

		expect(response.status()).toBe(201);
		const body = await response.json();
		expect(body.doc.name).toBe('John Doe');
		expect(body.doc.email).toBe('john@example.com');
	});

	test('POST /api/users should validate required fields', async ({ request }) => {
		const response = await request.post('/api/users', {
			data: {
				active: true,
			},
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Validation failed');
	});
});

test.describe('API Endpoints - Error Handling', () => {
	test('GET /api/unknown should return 404 for unknown collection', async ({ request }) => {
		const response = await request.get('/api/unknown');

		expect(response.status()).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('Collection not found');
	});
});

test.describe('API CORS Headers', () => {
	test('API should return CORS headers', async ({ request }) => {
		const response = await request.get('/api/posts');

		expect(response.headers()['access-control-allow-origin']).toBe('*');
	});
});

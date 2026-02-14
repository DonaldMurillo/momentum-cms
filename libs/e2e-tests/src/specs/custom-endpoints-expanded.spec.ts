import { test, expect, TEST_AUTHOR1_CREDENTIALS } from '../fixtures';

/**
 * Expanded custom endpoints E2E tests.
 * Tests new custom endpoints on categories collection:
 * - POST /custom-create
 * - PUT /custom-update
 * - POST /delete-by-slug
 * - GET /articles-by-slug (cross-collection query)
 * - GET /error-test (error handling)
 * - POST /sequential-ops (multi-operation flow)
 */
test.describe('Expanded custom collection endpoints', () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as author1
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author1 sign-in must succeed').toBe(true);

		// Clean up test data from previous runs
		const listResponse = await request.get('/api/categories?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; slug?: string }>;
			};
			for (const doc of listData.docs) {
				// Clean up custom endpoint test data (slugs starting with custom-ep- or seq-)
				if (doc.slug?.startsWith('custom-ep-') || doc.slug?.startsWith('seq-')) {
					await request.delete(`/api/categories/${doc.id}`);
				}
			}
		}
	});

	test('POST /custom-create with valid body creates document and returns it', async ({
		request,
	}) => {
		const createResponse = await request.post('/api/categories/custom-create', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Custom Create Test',
				slug: 'custom-ep-create-test',
			},
		});
		expect(createResponse.status(), 'Custom create should return 201').toBe(201);

		const body = (await createResponse.json()) as {
			doc: { id: string; name: string; slug: string };
		};
		expect(body.doc).toBeDefined();
		expect(body.doc.name).toBe('Custom Create Test');
		expect(body.doc.slug).toBe('custom-ep-create-test');
		expect(body.doc.id).toBeDefined();

		// Verify document was persisted via standard API
		const getResponse = await request.get(`/api/categories/${body.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: { slug: string } };
		expect(getBody.doc.slug).toBe('custom-ep-create-test');
	});

	test('POST /custom-create with missing fields returns 400 with error message', async ({
		request,
	}) => {
		// Missing slug field
		const missingSlugResponse = await request.post('/api/categories/custom-create', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Missing Slug',
			},
		});
		expect(missingSlugResponse.status()).toBe(400);

		const missingSlugBody = (await missingSlugResponse.json()) as { error: string };
		expect(missingSlugBody.error).toBeDefined();
		expect(missingSlugBody.error).toContain('slug');

		// Missing name field
		const missingNameResponse = await request.post('/api/categories/custom-create', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				slug: 'custom-ep-missing-name',
			},
		});
		expect(missingNameResponse.status()).toBe(400);

		const missingNameBody = (await missingNameResponse.json()) as { error: string };
		expect(missingNameBody.error).toBeDefined();
		expect(missingNameBody.error).toContain('name');

		// Missing both fields
		const emptyResponse = await request.post('/api/categories/custom-create', {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(emptyResponse.status()).toBe(400);

		// Verify no document was created by the invalid requests
		const listResponse = await request.get('/api/categories?limit=1000');

		const listData = (await listResponse.json()) as {
			docs: Array<{ slug?: string }>;
		};
		const badDoc = listData.docs.find((d) => d.slug === 'custom-ep-missing-name');
		expect(badDoc, 'No document should be created from invalid request').toBeUndefined();
	});

	test('PUT /custom-update parses body and updates a document', async ({ request }) => {
		// First create a document
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Original Name',
				slug: 'custom-ep-update-test',
			},
		});
		expect(createResponse.status(), 'Standard create should return 201').toBe(201);

		const createBody = (await createResponse.json()) as { doc: { id: string } };
		const docId = createBody.doc.id;

		// Update via custom endpoint
		const updateResponse = await request.put('/api/categories/custom-update', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				id: docId,
				name: 'Updated Name',
			},
		});
		expect(updateResponse.ok()).toBe(true);

		const updateBody = (await updateResponse.json()) as {
			doc: { id: string; name: string; slug: string };
		};
		expect(updateBody.doc).toBeDefined();
		expect(updateBody.doc.id).toBe(docId);
		expect(updateBody.doc.name).toBe('Updated Name');
		expect(updateBody.doc.slug).toBe('custom-ep-update-test');

		// Verify update persisted
		const getResponse = await request.get(`/api/categories/${docId}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: { name: string } };
		expect(getBody.doc.name).toBe('Updated Name');
	});

	test('PUT /custom-update with missing fields returns 400', async ({ request }) => {
		// Missing id field
		const missingIdResponse = await request.put('/api/categories/custom-update', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'No ID',
			},
		});
		expect(missingIdResponse.status()).toBe(400);

		// Missing name field
		const missingNameResponse = await request.put('/api/categories/custom-update', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				id: 'some-id',
			},
		});
		expect(missingNameResponse.status()).toBe(400);
	});

	test('POST /delete-by-slug finds and deletes by slug', async ({ request }) => {
		// Create a document to delete
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'To Be Deleted',
				slug: 'custom-ep-delete-test',
			},
		});
		expect(createResponse.status(), 'Standard create should return 201').toBe(201);

		const createBody = (await createResponse.json()) as { doc: { id: string } };
		const docId = createBody.doc.id;

		// Delete via custom endpoint
		const deleteResponse = await request.post('/api/categories/delete-by-slug', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				slug: 'custom-ep-delete-test',
			},
		});
		expect(deleteResponse.ok()).toBe(true);

		const deleteBody = (await deleteResponse.json()) as { deleted: boolean; slug: string };
		expect(deleteBody.deleted).toBe(true);
		expect(deleteBody.slug).toBe('custom-ep-delete-test');

		// Verify document was deleted — fetching by ID should return 404
		const getResponse = await request.get(`/api/categories/${docId}`);
		expect(getResponse.status(), 'Deleted document should return 404').toBe(404);
	});

	test('POST /delete-by-slug with nonexistent slug returns 404', async ({ request }) => {
		const deleteResponse = await request.post('/api/categories/delete-by-slug', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				slug: 'custom-ep-nonexistent-slug-12345',
			},
		});
		expect(deleteResponse.status()).toBe(404);

		const body = (await deleteResponse.json()) as { error: string };
		expect(body.error).toBeDefined();
		expect(body.error.toLowerCase()).toContain('not found');
	});

	test('GET /articles-by-slug returns cross-collection grouped data', async ({ request }) => {
		const response = await request.get('/api/categories/articles-by-slug');
		expect(response.ok()).toBe(true);

		const body = (await response.json()) as { articlesByCategory: Record<string, string[]> };
		expect(body.articlesByCategory).toBeDefined();
		expect(typeof body.articlesByCategory).toBe('object');
		expect(
			Object.keys(body.articlesByCategory).length,
			'articlesByCategory should have at least one category (requires seed data)',
		).toBeGreaterThan(0);

		// Verify technology category has articles (seeded data)
		expect(body.articlesByCategory.technology).toBeDefined();
		expect(Array.isArray(body.articlesByCategory.technology)).toBe(true);
		expect(body.articlesByCategory.technology.length).toBeGreaterThanOrEqual(1);

		// Each article should be a string (title)
		for (const articleTitle of body.articlesByCategory.technology) {
			expect(typeof articleTitle).toBe('string');
		}
	});

	test('GET /error-test returns 500 with error message', async ({ request }) => {
		const response = await request.get('/api/categories/error-test');
		expect(response.status()).toBe(500);

		const body = (await response.json()) as { error: string };
		expect(body.error).toBeDefined();
		expect(typeof body.error).toBe('string');
		expect(body.error.length).toBeGreaterThan(0);
	});

	test('POST /sequential-ops creates, updates, and reads back in sequence', async ({ request }) => {
		const response = await request.post('/api/categories/sequential-ops', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Sequential Test',
				slug: 'seq-test',
			},
		});
		expect(response.ok(), 'Sequential-ops should return 200').toBe(true);

		const body = (await response.json()) as {
			created: { id: string; name: string; slug: string };
			updated: { id: string; name: string; slug: string };
			readBack: { id: string; name: string; slug: string };
		};

		// Verify created document
		expect(body.created).toBeDefined();
		expect(body.created.name).toBe('Sequential Test');
		expect(body.created.slug).toBe('seq-test');
		expect(body.created.id).toBeDefined();

		// Verify updated document
		expect(body.updated).toBeDefined();
		expect(body.updated.id).toBe(body.created.id);
		expect(body.updated.name).toContain('Updated');
		expect(body.updated.slug).toBe('seq-test');

		// Verify readBack matches updated
		expect(body.readBack).toBeDefined();
		expect(body.readBack.id).toBe(body.updated.id);
		expect(body.readBack.name).toBe(body.updated.name);
		expect(body.readBack.slug).toBe(body.updated.slug);

		// Verify document persisted via standard API
		const getResponse = await request.get(`/api/categories/${body.created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: { name: string } };
		expect(getBody.doc.name).toBe(body.readBack.name);
	});

	test('custom endpoints coexist with standard CRUD operations', async ({ request }) => {
		// Standard list endpoint should still work
		const listResponse = await request.get('/api/categories?limit=5');
		expect(listResponse.ok()).toBe(true);

		const listData = (await listResponse.json()) as { docs: Array<{ id: string }> };
		expect(listData.docs.length).toBeGreaterThanOrEqual(1);

		// Standard create should still work
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Standard CRUD Test',
				slug: 'custom-ep-crud-test',
			},
		});
		expect(createResponse.status(), 'Standard create should return 201').toBe(201);

		const createBody = (await createResponse.json()) as { doc: { id: string } };
		const docId = createBody.doc.id;

		// Standard read should work
		const getResponse = await request.get(`/api/categories/${docId}`);
		expect(getResponse.ok()).toBe(true);

		// Standard update should work
		const updateResponse = await request.patch(`/api/categories/${docId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Updated via CRUD' },
		});
		expect(updateResponse.ok()).toBe(true);

		// Standard delete should work
		const deleteResponse = await request.delete(`/api/categories/${docId}`);
		expect(deleteResponse.ok()).toBe(true);

		// Custom endpoints should still work after CRUD operations
		const countResponse = await request.get('/api/categories/count');
		expect(countResponse.ok()).toBe(true);

		const countBody = (await countResponse.json()) as { count: number };
		expect(typeof countBody.count).toBe('number');
	});
});

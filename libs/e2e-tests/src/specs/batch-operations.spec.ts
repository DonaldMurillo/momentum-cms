import { test, expect, TEST_AUTHOR1_CREDENTIALS } from '../fixtures';

/**
 * Batch operations E2E tests.
 * Verifies batch create, update, and delete via the /batch endpoint.
 */
test.describe('Batch operations', () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author1 sign-in must succeed').toBe(true);

		// Clean up any leftover batch test data
		const listResponse = await request.get('/api/categories?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; slug?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.slug?.startsWith('batch-')) {
					await request.delete(`/api/categories/${doc.id}`);
				}
			}
		}
	});

	test('batch create: creates multiple documents atomically', async ({ request }) => {
		const response = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				operation: 'create',
				items: [
					{ name: 'Batch Cat 1', slug: 'batch-cat-1' },
					{ name: 'Batch Cat 2', slug: 'batch-cat-2' },
					{ name: 'Batch Cat 3', slug: 'batch-cat-3' },
				],
			},
		});
		expect(response.status()).toBe(201);

		const body = (await response.json()) as {
			docs: Array<{ id: string; name: string; slug: string }>;
			message: string;
		};
		expect(body.docs).toHaveLength(3);
		expect(body.message).toBe('3 documents created');

		// Verify all three exist
		const slugsResponse = await request.get('/api/categories/slugs');

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).toContain('batch-cat-1');
		expect(slugsData.slugs).toContain('batch-cat-2');
		expect(slugsData.slugs).toContain('batch-cat-3');
	});

	test('batch update: updates multiple documents atomically', async ({ request }) => {
		// First create some categories
		const createResponse = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				operation: 'create',
				items: [
					{ name: 'Batch Update A', slug: 'batch-update-a' },
					{ name: 'Batch Update B', slug: 'batch-update-b' },
				],
			},
		});
		expect(createResponse.status()).toBe(201);

		const created = (await createResponse.json()) as {
			docs: Array<{ id: string }>;
		};

		// Batch update
		const updateResponse = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				operation: 'update',
				items: [
					{ id: created.docs[0].id, data: { name: 'Batch Update A (Updated)' } },
					{ id: created.docs[1].id, data: { name: 'Batch Update B (Updated)' } },
				],
			},
		});
		expect(updateResponse.ok()).toBe(true);

		const updated = (await updateResponse.json()) as {
			docs: Array<{ id: string; name: string }>;
			message: string;
		};
		expect(updated.docs).toHaveLength(2);
		expect(updated.message).toBe('2 documents updated');

		// Verify updates
		const doc1Response = await request.get(`/api/categories/${created.docs[0].id}`);

		const doc1 = (await doc1Response.json()) as { doc: { name: string } };
		expect(doc1.doc.name).toBe('Batch Update A (Updated)');
	});

	test('batch delete: deletes multiple documents atomically', async ({ request }) => {
		// First create some categories
		const createResponse = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				operation: 'create',
				items: [
					{ name: 'Batch Delete A', slug: 'batch-delete-a' },
					{ name: 'Batch Delete B', slug: 'batch-delete-b' },
				],
			},
		});
		expect(createResponse.status()).toBe(201);

		const created = (await createResponse.json()) as {
			docs: Array<{ id: string }>;
		};
		const ids = created.docs.map((d) => d.id);

		// Batch delete
		const deleteResponse = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: { operation: 'delete', ids },
		});
		expect(deleteResponse.ok()).toBe(true);

		const deleted = (await deleteResponse.json()) as {
			results: Array<{ id: string; deleted: boolean }>;
			message: string;
		};
		expect(deleted.results).toHaveLength(2);
		expect(deleted.message).toBe('2 documents deleted');
		expect(deleted.results.every((r) => r.deleted)).toBe(true);

		// Verify deletions
		const slugsResponse = await request.get('/api/categories/slugs');

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).not.toContain('batch-delete-a');
		expect(slugsData.slugs).not.toContain('batch-delete-b');
	});

	test('batch create with invalid operation returns 400', async ({ request }) => {
		const response = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: { operation: 'invalid' },
		});
		expect(response.status()).toBe(400);

		const body = (await response.json()) as { error: string };
		expect(body.error).toContain('Invalid operation');
	});

	test('batch create with empty items returns empty array', async ({ request }) => {
		const response = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: { operation: 'create', items: [] },
		});
		expect(response.status()).toBe(201);

		const body = (await response.json()) as { docs: unknown[] };
		expect(body.docs).toHaveLength(0);
	});
});

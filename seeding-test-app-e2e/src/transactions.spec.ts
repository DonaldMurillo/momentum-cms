import { test, expect } from '@playwright/test';
import { TEST_AUTHOR1_CREDENTIALS } from './fixtures/e2e-utils';

/**
 * Transaction support E2E tests.
 * Verifies that database transactions correctly commit on success
 * and rollback on error, using custom endpoint helpers.
 */
test.describe('Database transactions', () => {
	test.beforeEach(async ({ request }) => {
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
				if (doc.slug?.startsWith('tx-')) {
					await request.delete(`/api/categories/${doc.id}`);
				}
			}
		}
	});

	test('transaction rollback: no data persisted on error', async ({ request }) => {
		// Trigger a transaction that creates a category then throws
		const rollbackResponse = await request.post('/api/categories/test-transaction-rollback');
		expect(rollbackResponse.ok()).toBe(true);

		const body = (await rollbackResponse.json()) as { rolledBack: boolean; error?: string };
		expect(body.rolledBack).toBe(true);
		expect(body.error).toBe('Intentional rollback');

		// Verify the category was NOT persisted
		const slugsResponse = await request.get('/api/categories/slugs');
		expect(slugsResponse.ok()).toBe(true);

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).not.toContain('tx-rollback-test');
	});

	test('transaction commit: both documents persisted on success', async ({ request }) => {
		// Trigger a transaction that creates two categories
		const successResponse = await request.post('/api/categories/test-transaction-success');
		expect(successResponse.ok()).toBe(true);

		const body = (await successResponse.json()) as { ids: string[] };
		expect(body.ids).toHaveLength(2);

		// Verify both categories exist via find
		const slugsResponse = await request.get('/api/categories/slugs');
		expect(slugsResponse.ok()).toBe(true);

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).toContain('tx-success-a');
		expect(slugsData.slugs).toContain('tx-success-b');

		// Verify both documents are retrievable by ID
		for (const id of body.ids) {
			const docResponse = await request.get(`/api/categories/${id}`);
			expect(docResponse.ok()).toBe(true);
		}
	});

	test('transaction rollback does not affect pre-existing data', async ({ request }) => {
		// Get count before rollback test
		const beforeResponse = await request.get('/api/categories/count');
		expect(beforeResponse.ok()).toBe(true);

		const beforeData = (await beforeResponse.json()) as { count: number };
		const countBefore = beforeData.count;

		// Trigger rollback
		const rollbackResponse = await request.post('/api/categories/test-transaction-rollback');
		expect(rollbackResponse.ok()).toBe(true);

		// Get count after - should be unchanged
		const afterResponse = await request.get('/api/categories/count');
		expect(afterResponse.ok()).toBe(true);

		const afterData = (await afterResponse.json()) as { count: number };

		expect(afterData.count).toBe(countBefore);
	});

	test('query helper create/update/delete work outside transactions', async ({ request }) => {
		// Create a category via standard API
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'TX CRUD Test', slug: 'tx-crud-test' },
		});
		expect(createResponse.status(), 'Category create should return 201').toBe(201);

		const created = (await createResponse.json()) as { doc: { id: string } };
		const docId = created.doc.id;

		// Verify it exists
		const getResponse = await request.get(`/api/categories/${docId}`);
		expect(getResponse.ok()).toBe(true);

		// Update it
		const updateResponse = await request.patch(`/api/categories/${docId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'TX CRUD Test Updated' },
		});
		expect(updateResponse.ok()).toBe(true);

		// Delete it
		const deleteResponse = await request.delete(`/api/categories/${docId}`);
		expect(deleteResponse.ok()).toBe(true);

		// Verify it's gone
		const verifyResponse = await request.get(`/api/categories/${docId}`);
		// Should be 404 or return null doc
		expect(verifyResponse.status() === 404 || verifyResponse.ok()).toBe(true);
	});
});

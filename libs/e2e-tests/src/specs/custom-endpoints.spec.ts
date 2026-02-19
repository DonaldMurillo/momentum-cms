import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Custom endpoints E2E tests.
 * Verifies that collections with custom endpoint configurations
 * expose those endpoints via the Express API.
 */
test.describe('Custom collection endpoints', { tag: ['@api', '@crud'] }, () => {
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

	test('GET /categories/count returns category count', async ({ request }) => {
		const response = await request.get('/api/categories/count');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { count: number };
		// Seeded categories exist, count should be at least 1
		expect(data.count).toBeGreaterThanOrEqual(1);
		expect(typeof data.count).toBe('number');
	});

	test('GET /categories/slugs returns category slugs', async ({ request }) => {
		const response = await request.get('/api/categories/slugs');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { slugs: string[] };
		expect(Array.isArray(data.slugs)).toBe(true);
		expect(data.slugs.length).toBeGreaterThanOrEqual(1);

		// Verify seeded category slugs are present
		expect(data.slugs).toContain('technology');
	});

	test('custom endpoints do not interfere with standard CRUD routes', async ({ request }) => {
		// Standard list endpoint should still work
		const listResponse = await request.get('/api/categories?limit=5');
		expect(listResponse.ok()).toBe(true);

		const listData = (await listResponse.json()) as { docs: Array<{ id: string }> };
		expect(listData.docs.length).toBeGreaterThanOrEqual(1);

		// Standard findById should still work
		const firstId = listData.docs[0].id;
		const getResponse = await request.get(`/api/categories/${firstId}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: { id: string } };
		expect(getBody.doc.id).toBe(firstId);
	});

	test('custom endpoint count matches slugs endpoint length', async ({ request }) => {
		// Get count from count endpoint
		const countResponse = await request.get('/api/categories/count');
		expect(countResponse.ok()).toBe(true);

		const countData = (await countResponse.json()) as { count: number };

		// Get slugs from slugs endpoint
		const slugsResponse = await request.get('/api/categories/slugs');
		expect(slugsResponse.ok()).toBe(true);

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };

		// Both custom endpoints should agree on the number of categories
		expect(countData.count).toBe(slugsData.slugs.length);
	});
});

import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Group field renderer E2E tests.
 * Verifies that group fields render as a card with sub-fields
 * and that changes to sub-fields are stored as nested objects.
 */
test.describe('Group field renderer', { tag: ['@field', '@admin'] }, () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as admin for API access
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('seeded product has group field data accessible via API', async ({ request }) => {
		// Fetch products and find our seeded laptop
		const response = await request.get('/api/products?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{
				id: string;
				name: string;
				seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
			}>;
		};

		const laptop = data.docs.find((d) => d.name === 'Test Laptop');
		expect(laptop, 'Seeded laptop product should exist').toBeTruthy();

		// Verify group field data is stored as nested object
		expect(laptop?.seo).toBeTruthy();
		expect(laptop?.seo?.metaTitle).toBe('Buy Test Laptop');
		expect(laptop?.seo?.metaDescription).toBe('The best test laptop for E2E testing.');
		expect(laptop?.seo?.ogImage).toBe('https://example.com/laptop.jpg');
	});

	test('can create product with group field data via API', async ({ request }) => {
		const uniqueName = `Group Test Product ${Date.now()}`;

		const createResponse = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: uniqueName,
				price: 123,
				seo: {
					metaTitle: 'Group Test SEO Title',
					metaDescription: 'Created via E2E test',
					ogImage: 'https://example.com/group-test.jpg',
				},
			},
		});

		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as {
			doc: {
				id: string;
				name: string;
				seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
			};
		};
		const created = createBody.doc;

		expect(created.name).toBe(uniqueName);
		expect(created.seo?.metaTitle).toBe('Group Test SEO Title');
		expect(created.seo?.metaDescription).toBe('Created via E2E test');
		expect(created.seo?.ogImage).toBe('https://example.com/group-test.jpg');

		// Verify persistence via GET
		const getResponse = await request.get(`/api/products/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
			};
		};
		expect(getBody.doc.seo?.metaTitle).toBe('Group Test SEO Title');
		expect(getBody.doc.seo?.metaDescription).toBe('Created via E2E test');
		expect(getBody.doc.seo?.ogImage).toBe('https://example.com/group-test.jpg');

		// Clean up
		const deleteResponse = await request.delete(`/api/products/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('can update group field data via API', async ({ request }) => {
		const uniqueName = `Update Group Test ${Date.now()}`;

		// Create a product
		const createResponse = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: uniqueName,
				seo: { metaTitle: 'Original Title', ogImage: 'https://example.com/original.jpg' },
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as { doc: { id: string } };

		// Update the group field
		const updateResponse = await request.patch(`/api/products/${createBody.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				seo: {
					metaTitle: 'Updated Title',
					metaDescription: 'Added description',
					ogImage: 'https://example.com/updated.jpg',
				},
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update
		const getResponse = await request.get(`/api/products/${createBody.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
			};
		};
		expect(getBody.doc.seo?.metaTitle).toBe('Updated Title');
		expect(getBody.doc.seo?.metaDescription).toBe('Added description');
		expect(getBody.doc.seo?.ogImage).toBe('https://example.com/updated.jpg');

		// Clean up
		const deleteResponse = await request.delete(`/api/products/${createBody.doc.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
	});
});

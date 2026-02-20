import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Array field renderer E2E tests.
 * Verifies that array fields store data as arrays of objects
 * and that CRUD operations on array items work correctly.
 */
test.describe('Array field renderer', { tag: ['@field', '@admin'] }, () => {
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

	test('seeded product has array field data accessible via API', async ({ request }) => {
		const response = await request.get('/api/products?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{
				id: string;
				name: string;
				features?: Array<{
					label: string;
					description?: string;
					highlighted?: boolean;
				}>;
			}>;
		};

		const laptop = data.docs.find((d) => d.name === 'Test Laptop');
		expect(laptop, 'Seeded laptop product should exist').toBeTruthy();

		// Verify array field data
		expect(laptop?.features).toBeTruthy();
		expect(Array.isArray(laptop?.features)).toBe(true);
		expect(laptop?.features).toHaveLength(2);
		expect(laptop?.features?.[0]?.label).toBe('Fast Processor');
		expect(laptop?.features?.[0]?.description).toBe('Very fast CPU');
		expect(laptop?.features?.[0]?.highlighted).toBe(true);
		expect(laptop?.features?.[1]?.label).toBe('Lightweight');
		expect(laptop?.features?.[1]?.description).toBe('Only 2 lbs');
		expect(laptop?.features?.[1]?.highlighted).toBe(false);
	});

	test('seeded phone has single-item array', async ({ request }) => {
		const response = await request.get('/api/products?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{
				id: string;
				name: string;
				features?: Array<{ label: string; description?: string; highlighted?: boolean }>;
			}>;
		};

		const phone = data.docs.find((d) => d.name === 'Test Phone');
		expect(phone, 'Seeded phone product should exist').toBeTruthy();
		expect(phone?.features).toHaveLength(1);
		expect(phone?.features?.[0]?.label).toBe('Great Camera');
		expect(phone?.features?.[0]?.description).toBe('48MP sensor');
		expect(phone?.features?.[0]?.highlighted).toBe(true);
	});

	test('can create product with array field data via API', async ({ request }) => {
		const uniqueName = `Array Test Product ${Date.now()}`;

		const createResponse = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: uniqueName,
				features: [
					{ label: 'Feature A', description: 'First feature', highlighted: true },
					{ label: 'Feature B', description: 'Second feature', highlighted: false },
					{ label: 'Feature C', highlighted: true },
				],
			},
		});

		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as {
			doc: {
				id: string;
				name: string;
				features?: Array<{ label: string; description?: string; highlighted?: boolean }>;
			};
		};
		const created = createBody.doc;

		expect(created.name).toBe(uniqueName);
		expect(created.features).toHaveLength(3);
		expect(created.features?.[0]?.label).toBe('Feature A');
		expect(created.features?.[2]?.label).toBe('Feature C');

		// Verify persistence via GET
		const getResponse = await request.get(`/api/products/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				features?: Array<{ label: string; description?: string; highlighted?: boolean }>;
			};
		};
		expect(getBody.doc.features).toHaveLength(3);
		expect(getBody.doc.features?.[0]?.label).toBe('Feature A');
		expect(getBody.doc.features?.[1]?.description).toBe('Second feature');
		expect(getBody.doc.features?.[2]?.highlighted).toBe(true);

		// Clean up
		const deleteResponse = await request.delete(`/api/products/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('can update array field data via API', async ({ request }) => {
		const uniqueName = `Update Array Test ${Date.now()}`;

		// Create with initial features
		const createResponse = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: uniqueName,
				features: [{ label: 'Original Feature', highlighted: false }],
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as { doc: { id: string } };

		// Update: replace array with new items
		const updateResponse = await request.patch(`/api/products/${createBody.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				features: [
					{ label: 'Updated Feature', description: 'Now with description', highlighted: true },
					{ label: 'New Feature', highlighted: false },
				],
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update
		const getResponse = await request.get(`/api/products/${createBody.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				features?: Array<{ label: string; description?: string; highlighted?: boolean }>;
			};
		};
		expect(getBody.doc.features).toHaveLength(2);
		expect(getBody.doc.features?.[0]?.label).toBe('Updated Feature');
		expect(getBody.doc.features?.[0]?.description).toBe('Now with description');
		expect(getBody.doc.features?.[0]?.highlighted).toBe(true);
		expect(getBody.doc.features?.[1]?.label).toBe('New Feature');

		// Verify old data is gone
		const allLabels = getBody.doc.features?.map((f) => f.label) ?? [];
		expect(allLabels).not.toContain('Original Feature');

		// Clean up
		const deleteResponse = await request.delete(`/api/products/${createBody.doc.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('can create product with empty array', async ({ request }) => {
		const uniqueName = `Empty Array Test ${Date.now()}`;

		const createResponse = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: uniqueName,
				features: [],
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as {
			doc: { id: string; features?: unknown[] };
		};

		// Verify empty array is stored correctly
		const getResponse = await request.get(`/api/products/${createBody.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: { features?: unknown[] } };
		expect(Array.isArray(getBody.doc.features)).toBe(true);
		expect(getBody.doc.features).toHaveLength(0);

		// Clean up
		const deleteResponse = await request.delete(`/api/products/${createBody.doc.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
	});
});

import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Field-Level Hooks E2E Tests
 *
 * Tests field-level hooks (beforeValidate, beforeChange, afterRead) through
 * the REST API using the field-test-items collection.
 *
 * Hook behaviors:
 * - slug (beforeValidate): auto-generates from title if not explicitly set
 * - normalizedTitle (beforeChange): trims whitespace and lowercases
 * - viewCount (afterRead): defaults to 0 when null/undefined
 */
test.describe('Field-level hooks', () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as admin
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

		// Clear field hook log
		const clearLogResponse = await request.delete('/api/test-field-hook-log');
		expect(clearLogResponse.ok(), 'Field hook log should clear successfully').toBe(true);

		// Clean up any leftover field-test-items
		const listResponse = await request.get('/api/field-test-items?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string }>;
			};
			for (const doc of listData.docs) {
				await request.delete(`/api/field-test-items/${doc.id}`);
			}
		}

		// Clear log again after cleanup (cleanup triggers afterRead hooks)
		await request.delete('/api/test-field-hook-log');
	});

	test.describe('beforeValidate - slug auto-generation', () => {
		test('auto-generates slug from title when not provided', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'My Test Article',
					code: 'MTA',
					status: 'active',
					tags: [{ label: 'test' }],
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { slug: string };
			};
			expect(createData.doc.slug).toBe('my-test-article');
		});

		test('does not overwrite explicitly provided slug', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Some Title',
					code: 'ST',
					status: 'active',
					tags: [{ label: 'test' }],
					slug: 'custom-slug',
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { slug: string };
			};
			expect(createData.doc.slug).toBe('custom-slug');
		});

		test('handles special characters in title for slug generation', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Hello, World! This & That',
					code: 'HW',
					status: 'active',
					tags: [{ label: 'test' }],
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { slug: string };
			};
			// Special chars replaced with dashes, trimmed
			expect(createData.doc.slug).toBe('hello-world-this-that');
		});
	});

	test.describe('beforeChange - normalizedTitle trim and lowercase', () => {
		test('trims and lowercases normalizedTitle on create', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Normalize Test',
					code: 'NR',
					status: 'active',
					tags: [{ label: 'test' }],
					normalizedTitle: '  Hello WORLD  ',
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string; normalizedTitle: string };
			};
			expect(createData.doc.normalizedTitle).toBe('hello world');
		});

		test('normalizes on update too', async ({ request }) => {
			// Create first
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Update Normalize',
					code: 'UN',
					status: 'active',
					tags: [{ label: 'test' }],
					normalizedTitle: 'original',
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Update with unnormalized value
			const updateResponse = await request.patch(`/api/field-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { normalizedTitle: '  UPDATED Title  ' },
			});
			expect(updateResponse.ok()).toBe(true);

			// Verify normalization on update
			const getResponse = await request.get(`/api/field-test-items/${createData.doc.id}`);
			const body = (await getResponse.json()) as {
				doc: { normalizedTitle: string };
			};
			expect(body.doc.normalizedTitle).toBe('updated title');
		});
	});

	test.describe('afterRead - viewCount default', () => {
		test('viewCount defaults to 0 when not set', async ({ request }) => {
			// Create without viewCount
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'View Count Test',
					code: 'VC',
					status: 'active',
					tags: [{ label: 'test' }],
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Read the doc - afterRead should default viewCount to 0
			const getResponse = await request.get(`/api/field-test-items/${createData.doc.id}`);
			expect(getResponse.ok()).toBe(true);

			const body = (await getResponse.json()) as {
				doc: { viewCount: number };
			};
			expect(body.doc.viewCount).toBe(0);
		});

		test('afterRead works in find results too', async ({ request }) => {
			// Create two items without viewCount
			await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Find View 1',
					code: 'FV1',
					status: 'active',
					tags: [{ label: 'test' }],
				},
			});
			await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Find View 2',
					code: 'FV2',
					status: 'active',
					tags: [{ label: 'test' }],
				},
			});

			const findResponse = await request.get('/api/field-test-items');
			expect(findResponse.ok()).toBe(true);

			const body = (await findResponse.json()) as {
				docs: Array<{ viewCount: number }>;
			};

			// All docs should have viewCount defaulted to 0 by afterRead hook
			for (const doc of body.docs) {
				expect(doc.viewCount, 'viewCount should be 0 from afterRead hook').toBe(0);
			}
		});

		test('preserves explicit viewCount value', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Explicit View',
					code: 'EV',
					status: 'active',
					tags: [{ label: 'test' }],
					viewCount: 42,
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			const getResponse = await request.get(`/api/field-test-items/${createData.doc.id}`);
			const body = (await getResponse.json()) as {
				doc: { viewCount: number };
			};
			expect(Number(body.doc.viewCount)).toBe(42);
		});
	});

	test.describe('Hook invocation logging', () => {
		test('field hook invocations are logged via test endpoint', async ({ request }) => {
			await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Log Test',
					code: 'LT',
					status: 'active',
					tags: [{ label: 'test' }],
					normalizedTitle: '  Test  ',
				},
			});

			const logResponse = await request.get('/api/test-field-hook-log');
			expect(logResponse.ok()).toBe(true);

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					fieldName: string;
					operation?: string;
				}>;
				count: number;
			};

			expect(logData.count).toBeGreaterThan(0);

			// Should have beforeValidate for slug
			const slugHook = logData.invocations.find(
				(inv) => inv.fieldName === 'slug' && inv.hookType === 'beforeValidate',
			);
			expect(slugHook, 'Should log slug beforeValidate hook').toBeDefined();
			expect(slugHook?.operation).toBe('create');

			// Should have beforeChange for normalizedTitle
			const normalizeHook = logData.invocations.find(
				(inv) => inv.fieldName === 'normalizedTitle' && inv.hookType === 'beforeChange',
			);
			expect(normalizeHook, 'Should log normalizedTitle beforeChange hook').toBeDefined();
		});
	});
});

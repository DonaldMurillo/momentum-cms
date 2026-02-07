import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Field-Level Validation E2E Tests
 *
 * Tests the built-in field constraint validators (minLength, maxLength, min, max,
 * step, email format, select options, array row limits) through the REST API.
 *
 * Uses the field-test-items collection which has:
 * - title: text, required, minLength: 3, maxLength: 100
 * - code: text, required, minLength: 2, maxLength: 10
 * - contactEmail: email
 * - rating: number, min: 1, max: 5, step: 1
 * - price: number, min: 0
 * - status: select (active/draft/archived), required
 * - tags: array, minRows: 1, maxRows: 5
 */
test.describe('Field-level validation', () => {
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
	});

	test.describe('Text field constraints', () => {
		test('rejects text below minLength', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'ab', // minLength is 3
					code: 'OK',
					status: 'active',
					tags: [{ label: 'tag1' }],
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				error: string;
				errors: Array<{ field: string; message: string }>;
			};
			expect(body.error).toBe('Validation failed');
			const titleError = body.errors.find((e) => e.field === 'title');
			expect(titleError, 'Should have a title validation error').toBeDefined();
			expect(titleError?.message).toContain('at least 3');
		});

		test('rejects text above maxLength', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Valid Title',
					code: 'TOOLONGCODE1', // maxLength is 10
					status: 'active',
					tags: [{ label: 'tag1' }],
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				error: string;
				errors: Array<{ field: string; message: string }>;
			};
			const codeError = body.errors.find((e) => e.field === 'code');
			expect(codeError, 'Should have a code validation error').toBeDefined();
			expect(codeError?.message).toContain('no more than 10');
		});

		test('accepts text at exact boundary values', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'abc', // exactly minLength=3
					code: '1234567890', // exactly maxLength=10
					status: 'active',
					tags: [{ label: 'tag1' }],
				},
			});
			expect(response.status()).toBe(201);
		});
	});

	test.describe('Email field validation', () => {
		test('rejects invalid email format', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Email Test',
					code: 'EM',
					status: 'active',
					tags: [{ label: 'tag1' }],
					contactEmail: 'not-an-email',
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const emailError = body.errors.find((e) => e.field === 'contactEmail');
			expect(emailError, 'Should have an email validation error').toBeDefined();
			expect(emailError?.message).toContain('valid email');
		});

		test('accepts valid email', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Email Valid',
					code: 'EV',
					status: 'active',
					tags: [{ label: 'tag1' }],
					contactEmail: 'user@example.com',
				},
			});
			expect(response.status()).toBe(201);
		});
	});

	test.describe('Number field constraints', () => {
		test('rejects number below min', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Number Test',
					code: 'NT',
					status: 'active',
					tags: [{ label: 'tag1' }],
					rating: 0, // min is 1
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const ratingError = body.errors.find((e) => e.field === 'rating');
			expect(ratingError, 'Should have a rating validation error').toBeDefined();
			expect(ratingError?.message).toContain('at least 1');
		});

		test('rejects number above max', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Number Max',
					code: 'NM',
					status: 'active',
					tags: [{ label: 'tag1' }],
					rating: 6, // max is 5
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const ratingError = body.errors.find((e) => e.field === 'rating');
			expect(ratingError, 'Should have a rating validation error').toBeDefined();
			expect(ratingError?.message).toContain('no more than 5');
		});

		test('rejects number violating step constraint', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Step Test',
					code: 'ST',
					status: 'active',
					tags: [{ label: 'tag1' }],
					rating: 2.5, // step is 1, must be integer
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const ratingError = body.errors.find((e) => e.field === 'rating');
			expect(ratingError, 'Should have a rating step error').toBeDefined();
			expect(ratingError?.message).toContain('multiple of 1');
		});

		test('rejects negative price', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Price Test',
					code: 'PT',
					status: 'active',
					tags: [{ label: 'tag1' }],
					price: -5, // min is 0
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const priceError = body.errors.find((e) => e.field === 'price');
			expect(priceError, 'Should have a price validation error').toBeDefined();
			expect(priceError?.message).toContain('at least 0');
		});

		test('accepts number at exact boundaries', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Boundary',
					code: 'BN',
					status: 'active',
					tags: [{ label: 'tag1' }],
					rating: 5, // exact max
					price: 0, // exact min
				},
			});
			expect(response.status()).toBe(201);
		});
	});

	test.describe('Select field validation', () => {
		test('rejects invalid select option', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Select Test',
					code: 'SE',
					status: 'invalid-option',
					tags: [{ label: 'tag1' }],
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const statusError = body.errors.find((e) => e.field === 'status');
			expect(statusError, 'Should have a status validation error').toBeDefined();
			expect(statusError?.message).toContain('invalid selection');
		});

		test('accepts all valid select options', async ({ request }) => {
			for (const status of ['active', 'draft', 'archived']) {
				const response = await request.post('/api/field-test-items', {
					headers: { 'Content-Type': 'application/json' },
					data: {
						title: `Select ${status}`,
						code: status.substring(0, 2).toUpperCase(),
						status,
						tags: [{ label: 'tag1' }],
					},
				});
				expect(response.status(), `Should accept status="${status}"`).toBe(201);
			}
		});
	});

	test.describe('Array field row limits', () => {
		test('rejects array below minRows', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'MinRows Test',
					code: 'MR',
					status: 'active',
					tags: [], // minRows is 1
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const tagsError = body.errors.find((e) => e.field === 'tags');
			expect(tagsError, 'Should have a tags row count error').toBeDefined();
			expect(tagsError?.message).toContain('at least 1');
		});

		test('rejects array above maxRows', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'MaxRows Test',
					code: 'XR',
					status: 'active',
					tags: [
						{ label: 'one' },
						{ label: 'two' },
						{ label: 'three' },
						{ label: 'four' },
						{ label: 'five' },
						{ label: 'six' }, // maxRows is 5
					],
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const tagsError = body.errors.find((e) => e.field === 'tags');
			expect(tagsError, 'Should have a tags row count error').toBeDefined();
			expect(tagsError?.message).toContain('at most 5');
		});
	});

	test.describe('Multiple errors', () => {
		test('returns multiple validation errors at once', async ({ request }) => {
			const response = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'ab', // too short
					code: 'TOOLONGCODE1', // too long
					status: 'invalid',
					tags: [],
					contactEmail: 'bad',
					rating: 0,
				},
			});
			expect(response.status()).toBe(400);

			const body = (await response.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			// Should have errors for title, code, status, tags, contactEmail, rating (at least 6)
			expect(body.errors.length).toBeGreaterThanOrEqual(6);

			const errorFields = body.errors.map((e) => e.field);
			expect(errorFields).toContain('title');
			expect(errorFields).toContain('code');
			expect(errorFields).toContain('status');
			expect(errorFields).toContain('tags');
			expect(errorFields).toContain('contactEmail');
			expect(errorFields).toContain('rating');
		});
	});

	test.describe('Validation on update', () => {
		test('validates constraints on update too', async ({ request }) => {
			// First create a valid document
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Valid Doc',
					code: 'VD',
					status: 'active',
					tags: [{ label: 'tag1' }],
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Try to update with invalid values
			const updateResponse = await request.patch(
				`/api/field-test-items/${createData.doc.id}`,
				{
					headers: { 'Content-Type': 'application/json' },
					data: {
						title: 'ab', // below minLength
					},
				},
			);
			expect(updateResponse.status()).toBe(400);

			const body = (await updateResponse.json()) as {
				errors: Array<{ field: string; message: string }>;
			};
			const titleError = body.errors.find((e) => e.field === 'title');
			expect(titleError, 'Should have a title validation error on update').toBeDefined();
		});
	});

	test.describe('Happy path', () => {
		test('creates valid document and persists all fields', async ({ request }) => {
			const createResponse = await request.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Complete Item',
					code: 'COMP',
					status: 'draft',
					contactEmail: 'test@example.com',
					rating: 3,
					price: 99.99,
					tags: [{ label: 'first' }, { label: 'second' }],
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string; title: string; code: string; status: string };
			};
			expect(createData.doc.title).toBe('Complete Item');
			expect(createData.doc.code).toBe('COMP');
			expect(createData.doc.status).toBe('draft');

			// Verify via GET
			const getResponse = await request.get(`/api/field-test-items/${createData.doc.id}`);
			expect(getResponse.ok()).toBe(true);

			const getBody = (await getResponse.json()) as {
				doc: {
					title: string;
					code: string;
					status: string;
					contactEmail: string;
					rating: number;
					price: number;
				};
			};
			expect(getBody.doc.title).toBe('Complete Item');
			expect(getBody.doc.contactEmail).toBe('test@example.com');
			expect(Number(getBody.doc.rating)).toBe(3);
			expect(Number(getBody.doc.price)).toBe(99.99);
		});
	});
});

import { test, expect, TEST_CREDENTIALS, TEST_VIEWER_CREDENTIALS } from './fixtures';
import { request as playwrightRequest } from '@playwright/test';

/**
 * Field-Level Access Control E2E Tests
 *
 * Tests that field-level access control (create/read/update) is enforced
 * through the REST API using the field-test-items collection.
 *
 * Field access rules:
 * - adminNotes: read/create/update restricted to admin role
 * - internalCode: read restricted to admin, create allowed for all, update denied for all
 * - internalScore: read denied for everyone (always hidden from responses)
 */
test.describe('Field-level access control', () => {
	let adminDocId: string;

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

		// Create a document with admin-only fields as admin
		const createResponse = await request.post('/api/field-test-items', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Access Test Item',
				code: 'ACC',
				status: 'active',
				tags: [{ label: 'test' }],
				adminNotes: 'Secret admin notes',
				internalCode: 'INT-001',
				internalScore: 42,
			},
		});
		expect(createResponse.status()).toBe(201);

		const createData = (await createResponse.json()) as {
			doc: { id: string };
		};
		adminDocId = createData.doc.id;
	});

	test.describe('Admin user access', () => {
		test('admin can read admin-only fields', async ({ request }) => {
			const response = await request.get(`/api/field-test-items/${adminDocId}`);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				doc: { adminNotes?: string; internalCode?: string };
			};
			expect(body.doc.adminNotes).toBe('Secret admin notes');
			expect(body.doc.internalCode).toBe('INT-001');
		});

		test('admin can update admin-only fields', async ({ request }) => {
			const updateResponse = await request.patch(`/api/field-test-items/${adminDocId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { adminNotes: 'Updated admin notes' },
			});
			expect(updateResponse.ok()).toBe(true);

			// Verify the update persisted
			const getResponse = await request.get(`/api/field-test-items/${adminDocId}`);
			const body = (await getResponse.json()) as {
				doc: { adminNotes: string };
			};
			expect(body.doc.adminNotes).toBe('Updated admin notes');
		});
	});

	test.describe('Viewer user access', () => {
		test('viewer cannot read admin-only fields (stripped from response)', async ({
			baseURL,
		}) => {
			// Create a fresh API context for viewer (separate cookie jar)
			const viewerCtx = await playwrightRequest.newContext({ baseURL: baseURL! });

			const signInResponse = await viewerCtx.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_VIEWER_CREDENTIALS.email,
					password: TEST_VIEWER_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Viewer sign-in must succeed').toBe(true);

			const response = await viewerCtx.get(`/api/field-test-items/${adminDocId}`);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				doc: Record<string, unknown>;
			};

			// Admin-only read fields should be stripped
			expect(
				body.doc['adminNotes'],
				'adminNotes should be stripped from viewer response',
			).toBeUndefined();
			expect(
				body.doc['internalCode'],
				'internalCode should be stripped from viewer response',
			).toBeUndefined();

			// Regular fields should still be visible
			expect(body.doc['title']).toBe('Access Test Item');
			expect(body.doc['code']).toBe('ACC');

			await viewerCtx.dispose();
		});

		test('viewer cannot create with admin-only fields (stripped before save)', async ({
			request,
			baseURL,
		}) => {
			// Create a fresh API context for viewer
			const viewerCtx = await playwrightRequest.newContext({ baseURL: baseURL! });

			const signInResponse = await viewerCtx.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_VIEWER_CREDENTIALS.email,
					password: TEST_VIEWER_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Viewer sign-in must succeed').toBe(true);

			const createResponse = await viewerCtx.post('/api/field-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'Viewer Created',
					code: 'VC',
					status: 'draft',
					tags: [{ label: 'test' }],
					adminNotes: 'Should be stripped',
					internalCode: 'Should be allowed', // create: () => true
				},
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			await viewerCtx.dispose();

			// Use admin request to check what was actually saved
			const getResponse = await request.get(`/api/field-test-items/${createData.doc.id}`);
			const body = (await getResponse.json()) as {
				doc: Record<string, unknown>;
			};

			// adminNotes should have been stripped (viewer can't create it)
			expect(
				body.doc['adminNotes'] ?? null,
				'adminNotes should not have been saved',
			).toBeNull();

			// internalCode should have been saved (create: () => true allows all)
			expect(body.doc['internalCode']).toBe('Should be allowed');
		});
	});

	test.describe('Non-updatable field', () => {
		test('field with update: () => false stays unchanged on update', async ({ request }) => {
			// Try to update internalCode (update: () => false)
			const updateResponse = await request.patch(`/api/field-test-items/${adminDocId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { internalCode: 'CHANGED' },
			});
			expect(updateResponse.ok()).toBe(true);

			// Verify internalCode was NOT changed
			const getResponse = await request.get(`/api/field-test-items/${adminDocId}`);
			const body = (await getResponse.json()) as {
				doc: { internalCode: string };
			};
			expect(body.doc.internalCode, 'internalCode should remain unchanged').toBe('INT-001');
		});
	});

	test.describe('Always-hidden field', () => {
		test('field with read: () => false is stripped for everyone', async ({ request }) => {
			// Even admin should not see internalScore (read: () => false)
			const response = await request.get(`/api/field-test-items/${adminDocId}`);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				doc: Record<string, unknown>;
			};
			expect(
				body.doc['internalScore'],
				'internalScore should be stripped even for admin',
			).toBeUndefined();
		});
	});

	test.describe('Field access in list responses', () => {
		test('field access filtering works on find (list) responses', async ({ baseURL }) => {
			// Create a fresh API context for viewer
			const viewerCtx = await playwrightRequest.newContext({ baseURL: baseURL! });

			const signInResponse = await viewerCtx.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_VIEWER_CREDENTIALS.email,
					password: TEST_VIEWER_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Viewer sign-in must succeed').toBe(true);

			const findResponse = await viewerCtx.get('/api/field-test-items');
			expect(findResponse.ok()).toBe(true);

			const body = (await findResponse.json()) as {
				docs: Array<Record<string, unknown>>;
			};
			expect(body.docs.length).toBeGreaterThan(0);

			// All docs in list should have admin fields stripped for viewer
			for (const doc of body.docs) {
				expect(
					doc['adminNotes'],
					'adminNotes should be stripped in list for viewer',
				).toBeUndefined();
				expect(
					doc['internalCode'],
					'internalCode should be stripped in list for viewer',
				).toBeUndefined();
			}

			await viewerCtx.dispose();
		});
	});
});

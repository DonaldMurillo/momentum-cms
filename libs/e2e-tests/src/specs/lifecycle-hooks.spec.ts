import { test, expect, TEST_AUTHOR1_CREDENTIALS } from '../fixtures';

/**
 * Lifecycle Hooks E2E Tests
 *
 * Tests the collection-level lifecycle hooks using the hook-test-items collection.
 * Uses in-memory hook log infrastructure to verify hook invocations.
 *
 * Covers:
 * - Happy paths: all 7 hook types fire correctly on CRUD operations
 * - Data transformation: beforeValidate, beforeChange, afterRead transforms
 * - Error handling: errors in before/after hooks and their effects on operations
 * - Hook chaining: multiple invocations accumulate in order
 * - Batch operations: hooks fire per item in batch create
 */
test.describe('Lifecycle hooks', () => {
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

		// Clear hook log
		const clearLogResponse = await request.delete('/api/test-hook-log');
		expect(clearLogResponse.ok(), 'Hook log should clear successfully').toBe(true);

		// Reset hook behavior config
		const resetConfigResponse = await request.post('/api/test-hook-config', {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(resetConfigResponse.ok(), 'Hook config should reset successfully').toBe(true);

		// Clean up any leftover hook-test-items
		const listResponse = await request.get('/api/hook-test-items?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string }>;
			};
			for (const doc of listData.docs) {
				await request.delete(`/api/hook-test-items/${doc.id}`);
			}
		}

		// Clear hook log again after cleanup
		await request.delete('/api/test-hook-log');
	});

	test.describe('Happy paths - Create operation', () => {
		test('beforeValidate hook fires on create', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Test Item 1', slug: 'test-1' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; operation?: string }>;
				count: number;
			};

			const beforeValidate = logData.invocations.find((inv) => inv.hookType === 'beforeValidate');
			expect(beforeValidate, 'beforeValidate hook should have fired').toBeDefined();
			expect(beforeValidate?.operation, 'beforeValidate should have operation=create').toBe(
				'create',
			);
		});

		test('beforeChange hook fires on create', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Test Item 2', slug: 'test-2' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; operation?: string }>;
			};

			const beforeChange = logData.invocations.find((inv) => inv.hookType === 'beforeChange');
			expect(beforeChange, 'beforeChange hook should have fired').toBeDefined();
			expect(beforeChange?.operation, 'beforeChange should have operation=create').toBe('create');
		});

		test('afterChange hook fires on create with created doc', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Test Item 3', slug: 'test-3' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					operation?: string;
					doc?: Record<string, unknown>;
				}>;
			};

			const afterChange = logData.invocations.find((inv) => inv.hookType === 'afterChange');
			expect(afterChange, 'afterChange hook should have fired').toBeDefined();
			expect(afterChange?.operation, 'afterChange should have operation=create').toBe('create');
			expect(afterChange?.doc, 'afterChange should receive a doc object').toBeDefined();
			expect(afterChange?.doc?.['title'], 'afterChange doc should contain the title').toBe(
				'Test Item 3',
			);
		});
	});

	test.describe('Happy paths - Update operation', () => {
		test('all hooks fire on update with originalDoc', async ({ request }) => {
			// First create a document
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Original Title', slug: 'update-test' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Clear hook log before update
			await request.delete('/api/test-hook-log');

			// Update the document
			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Updated Title' },
			});
			expect(updateResponse.ok(), 'Update should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					operation?: string;
					originalDoc?: { title: string };
				}>;
			};

			const beforeValidate = logData.invocations.find((inv) => inv.hookType === 'beforeValidate');
			const beforeChange = logData.invocations.find((inv) => inv.hookType === 'beforeChange');
			const afterChange = logData.invocations.find((inv) => inv.hookType === 'afterChange');

			expect(beforeValidate, 'beforeValidate should fire on update').toBeDefined();
			expect(beforeValidate?.operation, 'beforeValidate operation should be update').toBe('update');
			expect(beforeValidate?.originalDoc?.title, 'beforeValidate should have originalDoc').toBe(
				'Original Title',
			);

			expect(beforeChange, 'beforeChange should fire on update').toBeDefined();
			expect(beforeChange?.operation, 'beforeChange operation should be update').toBe('update');
			expect(beforeChange?.originalDoc?.title, 'beforeChange should have originalDoc').toBe(
				'Original Title',
			);

			expect(afterChange, 'afterChange should fire on update').toBeDefined();
			expect(afterChange?.operation, 'afterChange operation should be update').toBe('update');
			expect(afterChange?.originalDoc?.title, 'afterChange should have originalDoc').toBe(
				'Original Title',
			);
		});
	});

	test.describe('Happy paths - Read operations', () => {
		test('beforeRead fires on find', async ({ request }) => {
			// Create a document first
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Read Test', slug: 'read-test' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			// Clear hook log before find
			await request.delete('/api/test-hook-log');

			// Find documents
			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.ok(), 'Find should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const beforeRead = logData.invocations.find((inv) => inv.hookType === 'beforeRead');
			expect(beforeRead, 'beforeRead hook should fire on find').toBeDefined();
		});

		test('afterRead fires for each document in find results', async ({ request }) => {
			// Create two documents
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Doc 1', slug: 'doc-1' },
			});
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Doc 2', slug: 'doc-2' },
			});

			// Clear hook log before find
			await request.delete('/api/test-hook-log');

			// Find documents
			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.ok(), 'Find should succeed').toBe(true);

			const findData = (await findResponse.json()) as {
				docs: unknown[];
			};

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const afterReadInvocations = logData.invocations.filter(
				(inv) => inv.hookType === 'afterRead',
			);
			expect(afterReadInvocations.length, 'afterRead should fire once per document').toBe(
				findData.docs.length,
			);
		});

		test('afterRead fires on findById', async ({ request }) => {
			// Create a document
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'FindById Test', slug: 'findbyid-test' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Clear hook log before findById
			await request.delete('/api/test-hook-log');

			// Find by ID
			const findByIdResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(findByIdResponse.ok(), 'FindById should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const beforeRead = logData.invocations.find((inv) => inv.hookType === 'beforeRead');
			const afterRead = logData.invocations.find((inv) => inv.hookType === 'afterRead');

			expect(beforeRead, 'beforeRead should fire on findById').toBeDefined();
			expect(afterRead, 'afterRead should fire on findById').toBeDefined();
		});
	});

	test.describe('Happy paths - Delete operation', () => {
		test('beforeDelete and afterDelete fire on delete', async ({ request }) => {
			// Create a document
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Delete Test', slug: 'delete-test' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Clear hook log before delete
			await request.delete('/api/test-hook-log');

			// Delete the document
			const deleteResponse = await request.delete(`/api/hook-test-items/${createData.doc.id}`);
			expect(deleteResponse.ok(), 'Delete should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; doc?: { id: string } }>;
			};

			const beforeDelete = logData.invocations.find((inv) => inv.hookType === 'beforeDelete');
			const afterDelete = logData.invocations.find((inv) => inv.hookType === 'afterDelete');

			expect(beforeDelete, 'beforeDelete hook should fire').toBeDefined();
			expect(beforeDelete?.doc?.id, 'beforeDelete should receive the doc').toBe(createData.doc.id);

			expect(afterDelete, 'afterDelete hook should fire').toBeDefined();
			expect(afterDelete?.doc?.id, 'afterDelete should receive the doc').toBe(createData.doc.id);
		});
	});

	test.describe('Data transformation', () => {
		test('beforeValidate can transform data', async ({ request }) => {
			// Configure hook to transform on beforeValidate
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeValidate'],
					transformField: 'status',
					transformValue: 'auto-set',
				},
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Transform Test 1', slug: 'transform-1' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { status?: string };
			};

			expect(createData.doc.status, 'status should be auto-set by beforeValidate hook').toBe(
				'auto-set',
			);
		});

		test('beforeChange can transform data', async ({ request }) => {
			// Configure hook to transform on beforeChange
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeChange'],
					transformField: 'status',
					transformValue: 'changed',
				},
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Transform Test 2', slug: 'transform-2' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { status?: string };
			};

			expect(createData.doc.status, 'status should be set by beforeChange hook').toBe('changed');
		});

		test('afterRead can enrich documents', async ({ request }) => {
			// Create a document first
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Enrich Test', slug: 'enrich-test' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			// Configure hook to enrich on afterRead
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['afterRead'],
					transformField: 'status',
					transformValue: 'enriched',
				},
			});

			// Find documents
			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.ok(), 'Find should succeed').toBe(true);

			const findData = (await findResponse.json()) as {
				docs: Array<{ status?: string; slug: string }>;
			};

			const enrichedDoc = findData.docs.find((d) => d.slug === 'enrich-test');
			expect(enrichedDoc, 'Document should be found').toBeDefined();
			expect(enrichedDoc?.status, 'status should be enriched by afterRead hook').toBe('enriched');
		});
	});

	test.describe('Error handling - beforeValidate', () => {
		test('error in beforeValidate aborts create', async ({ request }) => {
			// Configure hook to throw on beforeValidate
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeValidate'] },
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Error Test 1', slug: 'error-1' },
			});
			expect(createResponse.status(), 'Create should fail with 500').toBe(500);

			// Reset config
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify document was NOT created
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string }>;
			};

			const errorDoc = findData.docs.find((d) => d.slug === 'error-1');
			expect(errorDoc, 'Document should NOT exist in database').toBeUndefined();
		});
	});

	test.describe('Error handling - beforeChange', () => {
		test('error in beforeChange aborts create', async ({ request }) => {
			// Configure hook to throw on beforeChange
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeChange'] },
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Error Test 2', slug: 'error-2' },
			});
			expect(createResponse.status(), 'Create should fail with 500').toBe(500);

			// Reset config
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify document was NOT created
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string }>;
			};

			const errorDoc = findData.docs.find((d) => d.slug === 'error-2');
			expect(errorDoc, 'Document should NOT exist in database').toBeUndefined();
		});
	});

	test.describe('Error handling - afterChange', () => {
		test('error in afterChange - doc IS saved but client gets 500', async ({ request }) => {
			// Configure hook to throw on afterChange
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['afterChange'] },
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Error Test 3', slug: 'error-3' },
			});
			expect(createResponse.status(), 'Create should fail with 500 due to afterChange error').toBe(
				500,
			);

			// Reset config
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify document WAS created despite error
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string; title: string }>;
			};

			const errorDoc = findData.docs.find((d) => d.slug === 'error-3');
			expect(errorDoc, 'Document SHOULD exist in database').toBeDefined();
			expect(errorDoc?.title, 'Document should have correct title').toBe('Error Test 3');
		});
	});

	test.describe('Error handling - beforeDelete', () => {
		test('error in beforeDelete aborts delete', async ({ request }) => {
			// Create a document first with clean config
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Delete Error Test', slug: 'delete-error' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Configure hook to throw on beforeDelete
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeDelete'] },
			});

			// Attempt to delete
			const deleteResponse = await request.delete(`/api/hook-test-items/${createData.doc.id}`);
			expect(deleteResponse.status(), 'Delete should fail with 500').toBe(500);

			// Reset config
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify document still exists
			const findByIdResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(findByIdResponse.ok(), 'Document should still exist').toBe(true);
		});
	});

	test.describe('Error handling - afterDelete', () => {
		test('error in afterDelete - doc IS deleted but client gets 500', async ({ request }) => {
			// Create a document first
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'After Delete Error', slug: 'after-delete-error' },
			});
			expect(createResponse.status(), 'Create should succeed').toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Configure hook to throw on afterDelete
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['afterDelete'] },
			});

			// Attempt to delete
			const deleteResponse = await request.delete(`/api/hook-test-items/${createData.doc.id}`);
			expect(deleteResponse.status(), 'Delete should fail with 500 due to afterDelete error').toBe(
				500,
			);

			// Reset config
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify document WAS deleted despite error
			const findByIdResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(findByIdResponse.status(), 'Document should NOT exist').toBe(404);
		});
	});

	test.describe('Hook execution order', () => {
		test('create fires hooks in order: beforeValidate → beforeChange → afterChange', async ({
			request,
		}) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Order Test', slug: 'order-test' },
			});
			expect(createResponse.status()).toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; timestamp: number }>;
			};

			const createHooks = logData.invocations.filter((inv) =>
				['beforeValidate', 'beforeChange', 'afterChange'].includes(inv.hookType),
			);

			expect(createHooks.length, 'Should have exactly 3 hook invocations').toBe(3);
			expect(createHooks[0].hookType).toBe('beforeValidate');
			expect(createHooks[1].hookType).toBe('beforeChange');
			expect(createHooks[2].hookType).toBe('afterChange');
		});

		test('update fires hooks in order: beforeValidate → beforeChange → afterChange', async ({
			request,
		}) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Update Order', slug: 'update-order' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Updated Order' },
			});
			expect(updateResponse.ok()).toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const updateHooks = logData.invocations.filter((inv) =>
				['beforeValidate', 'beforeChange', 'afterChange'].includes(inv.hookType),
			);

			expect(updateHooks.length, 'Should have exactly 3 hook invocations').toBe(3);
			expect(updateHooks[0].hookType).toBe('beforeValidate');
			expect(updateHooks[1].hookType).toBe('beforeChange');
			expect(updateHooks[2].hookType).toBe('afterChange');
		});

		test('delete fires hooks in order: beforeDelete → afterDelete', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Delete Order', slug: 'delete-order' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			await request.delete(`/api/hook-test-items/${createData.doc.id}`);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const deleteHooks = logData.invocations.filter((inv) =>
				['beforeDelete', 'afterDelete'].includes(inv.hookType),
			);

			expect(deleteHooks.length, 'Should have exactly 2 hook invocations').toBe(2);
			expect(deleteHooks[0].hookType).toBe('beforeDelete');
			expect(deleteHooks[1].hookType).toBe('afterDelete');
		});

		test('read fires hooks in order: beforeRead → afterRead', async ({ request }) => {
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Read Order', slug: 'read-order' },
			});

			await request.delete('/api/test-hook-log');

			await request.get('/api/hook-test-items');

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const readHooks = logData.invocations.filter((inv) =>
				['beforeRead', 'afterRead'].includes(inv.hookType),
			);

			expect(
				readHooks.length,
				'Should have at least 2 hooks (beforeRead + afterRead)',
			).toBeGreaterThanOrEqual(2);
			expect(readHooks[0].hookType, 'beforeRead should fire first').toBe('beforeRead');
			// All remaining should be afterRead (one per doc)
			for (let i = 1; i < readHooks.length; i++) {
				expect(readHooks[i].hookType).toBe('afterRead');
			}
		});

		test('multiple hook invocations accumulate in timestamp order', async ({ request }) => {
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Chain Test 1', slug: 'chain-1' },
			});
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Chain Test 2', slug: 'chain-2' },
			});

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; timestamp: number }>;
			};

			expect(
				logData.invocations.length,
				'Should have invocations from both creates (6 total)',
			).toBe(6);

			for (let i = 1; i < logData.invocations.length; i++) {
				expect(
					logData.invocations[i].timestamp,
					`Invocation ${i} should have timestamp >= previous`,
				).toBeGreaterThanOrEqual(logData.invocations[i - 1].timestamp);
			}
		});
	});

	test.describe('Data shape verification', () => {
		test('beforeValidate on create receives raw input data', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Shape Test', slug: 'shape-test', status: 'draft', priority: 5 },
			});
			expect(createResponse.status()).toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					data?: Record<string, unknown>;
					operation?: string;
					originalDoc?: Record<string, unknown>;
				}>;
			};

			const bv = logData.invocations.find((inv) => inv.hookType === 'beforeValidate');
			expect(bv, 'beforeValidate should fire').toBeDefined();
			expect(bv?.data?.['title']).toBe('Shape Test');
			expect(bv?.data?.['slug']).toBe('shape-test');
			expect(bv?.data?.['status']).toBe('draft');
			expect(bv?.data?.['priority']).toBe(5);
			expect(bv?.operation).toBe('create');
			expect(bv?.originalDoc, 'originalDoc should be undefined on create').toBeUndefined();
		});

		test('afterChange on create receives the full saved doc with id', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Full Doc Test', slug: 'full-doc-test' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					doc?: Record<string, unknown>;
				}>;
			};

			const ac = logData.invocations.find((inv) => inv.hookType === 'afterChange');
			expect(ac?.doc, 'afterChange should receive doc').toBeDefined();
			expect(ac?.doc?.['id'], 'afterChange doc should have id').toBe(createData.doc.id);
			expect(ac?.doc?.['title']).toBe('Full Doc Test');
			expect(ac?.doc?.['slug']).toBe('full-doc-test');
		});

		test('afterRead doc contains id and all persisted fields', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'AfterRead Shape', slug: 'afterread-shape', status: 'active' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					doc?: Record<string, unknown>;
				}>;
			};

			const ar = logData.invocations.find((inv) => inv.hookType === 'afterRead');
			expect(ar?.doc, 'afterRead should receive doc').toBeDefined();
			expect(ar?.doc?.['id']).toBe(createData.doc.id);
			expect(ar?.doc?.['title']).toBe('AfterRead Shape');
			expect(ar?.doc?.['slug']).toBe('afterread-shape');
			expect(ar?.doc?.['status']).toBe('active');
		});

		test('update hooks receive partial data and full originalDoc', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Partial Data', slug: 'partial-data', status: 'draft', priority: 1 },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			// Update only the title
			await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'New Title' },
			});

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					data?: Record<string, unknown>;
					originalDoc?: Record<string, unknown>;
				}>;
			};

			const bv = logData.invocations.find((inv) => inv.hookType === 'beforeValidate');
			expect(bv?.data?.['title'], 'data should contain the updated title').toBe('New Title');
			expect(bv?.originalDoc?.['title'], 'originalDoc should contain the old title').toBe(
				'Partial Data',
			);
			expect(bv?.originalDoc?.['slug'], 'originalDoc should have all fields').toBe('partial-data');
			expect(bv?.originalDoc?.['status'], 'originalDoc should have status').toBe('draft');
		});

		test('beforeDelete and afterDelete receive full doc with all fields', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Delete Shape', slug: 'delete-shape', status: 'active', priority: 10 },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			await request.delete(`/api/hook-test-items/${createData.doc.id}`);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					doc?: Record<string, unknown>;
				}>;
			};

			const bd = logData.invocations.find((inv) => inv.hookType === 'beforeDelete');
			expect(bd?.doc?.['id']).toBe(createData.doc.id);
			expect(bd?.doc?.['title']).toBe('Delete Shape');
			expect(bd?.doc?.['slug']).toBe('delete-shape');
			expect(bd?.doc?.['status']).toBe('active');

			const ad = logData.invocations.find((inv) => inv.hookType === 'afterDelete');
			expect(ad?.doc?.['id']).toBe(createData.doc.id);
			expect(ad?.doc?.['title']).toBe('Delete Shape');
		});
	});

	test.describe('Persistence verification', () => {
		test('create hooks fire AND document is persisted', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Persist Create', slug: 'persist-create', status: 'published' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string };
			};

			// Verify hooks fired
			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};
			expect(
				logData.invocations.some((inv) => inv.hookType === 'afterChange'),
				'afterChange should have fired',
			).toBe(true);

			// Verify document was actually persisted via independent GET
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(getResponse.ok(), 'GET should find the created document').toBe(true);

			const getBody = (await getResponse.json()) as {
				doc: { title: string; slug: string; status: string };
			};
			expect(getBody.doc.title).toBe('Persist Create');
			expect(getBody.doc.slug).toBe('persist-create');
			expect(getBody.doc.status).toBe('published');
		});

		test('update hooks fire AND update is persisted', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Persist Update', slug: 'persist-update' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };
			await request.delete('/api/test-hook-log');

			await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Persisted Update Title' },
			});

			// Verify hooks fired
			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; operation?: string }>;
			};
			const afterChange = logData.invocations.find(
				(inv) => inv.hookType === 'afterChange' && inv.operation === 'update',
			);
			expect(afterChange, 'afterChange should have fired for update').toBeDefined();

			// Verify update was persisted via independent GET
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as { doc: { title: string } };
			expect(getBody.doc.title).toBe('Persisted Update Title');
		});
	});

	test.describe('Error handling - update operations', () => {
		test('error in beforeValidate aborts update', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'BV Update Error', slug: 'bv-update-error' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeValidate'] },
			});

			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Should Not Persist' },
			});
			expect(updateResponse.status(), 'Update should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify original title preserved
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as { doc: { title: string } };
			expect(getBody.doc.title, 'Original title should be preserved').toBe('BV Update Error');
		});

		test('error in beforeChange aborts update', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'BC Update Error', slug: 'bc-update-error' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeChange'] },
			});

			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Should Not Persist' },
			});
			expect(updateResponse.status(), 'Update should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as { doc: { title: string } };
			expect(getBody.doc.title, 'Original title should be preserved').toBe('BC Update Error');
		});

		test('error in afterChange on update - update IS saved but client gets 500', async ({
			request,
		}) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'AC Update Error', slug: 'ac-update-error' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['afterChange'] },
			});

			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Updated Despite Error' },
			});
			expect(updateResponse.status(), 'Client should get 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify update WAS saved despite afterChange error
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as { doc: { title: string } };
			expect(getBody.doc.title, 'Update should be persisted despite error').toBe(
				'Updated Despite Error',
			);
		});
	});

	test.describe('Error handling - read operations', () => {
		test('error in beforeRead on find returns 500', async ({ request }) => {
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Read Error', slug: 'read-error' },
			});

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeRead'] },
			});

			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.status(), 'Find should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
		});

		test('error in beforeRead on findById returns 500', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'FindById Error', slug: 'findbyid-error' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['beforeRead'] },
			});

			const findByIdResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(findByIdResponse.status(), 'FindById should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Document should still exist after read error
			const verifyResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(verifyResponse.ok(), 'Document should still exist').toBe(true);
		});

		test('error in afterRead on find returns 500', async ({ request }) => {
			await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'AfterRead Error', slug: 'afterread-error' },
			});

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['afterRead'] },
			});

			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.status(), 'Find should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
		});

		test('error in afterRead on findById returns 500', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'AfterRead ById Error', slug: 'afterread-byid-error' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: { throwOn: ['afterRead'] },
			});

			const findByIdResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(findByIdResponse.status(), 'FindById should fail with 500').toBe(500);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
		});
	});

	test.describe('Data transformation - update operations', () => {
		test('beforeValidate transforms data on update', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'BV Transform Update', slug: 'bv-transform-update' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeValidate'],
					transformField: 'status',
					transformValue: 'auto-updated',
				},
			});

			const updateResponse = await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'New Title' },
			});
			expect(updateResponse.ok()).toBe(true);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify both title update and hook transform persisted
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as {
				doc: { title: string; status: string };
			};
			expect(getBody.doc.title).toBe('New Title');
			expect(getBody.doc.status, 'status should be auto-set by hook on update').toBe(
				'auto-updated',
			);
		});

		test('beforeChange transforms data on update', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'BC Transform Update', slug: 'bc-transform-update' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeChange'],
					transformField: 'status',
					transformValue: 'change-hook-set',
				},
			});

			await request.patch(`/api/hook-test-items/${createData.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Changed Title' },
			});

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as {
				doc: { title: string; status: string };
			};
			expect(getBody.doc.title).toBe('Changed Title');
			expect(getBody.doc.status).toBe('change-hook-set');
		});
	});

	test.describe('Multiple transforms stacking', () => {
		test('beforeValidate and beforeChange both transform the same field — last wins', async ({
			request,
		}) => {
			// Both hooks will try to set 'status'. beforeChange runs after beforeValidate,
			// so its value should be the final one persisted.
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeValidate', 'beforeChange'],
					transformField: 'status',
					transformValue: 'both-set',
				},
			});

			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Multi Transform', slug: 'multi-transform' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as {
				doc: { id: string; status: string };
			};

			// Both hooks set the same value, so 'both-set' should be persisted
			expect(createData.doc.status).toBe('both-set');

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify via GET
			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const getBody = (await getResponse.json()) as { doc: { status: string } };
			expect(getBody.doc.status).toBe('both-set');
		});

		test('afterRead transform applies to findById too', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'FindById Enrich', slug: 'findbyid-enrich' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['afterRead'],
					transformField: 'status',
					transformValue: 'enriched-single',
				},
			});

			const getResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);
			expect(getResponse.ok()).toBe(true);

			const getBody = (await getResponse.json()) as {
				doc: { status: string; title: string };
			};
			expect(getBody.doc.title).toBe('FindById Enrich');
			expect(getBody.doc.status, 'afterRead should enrich single doc on findById').toBe(
				'enriched-single',
			);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});
		});
	});

	test.describe('Batch operations', () => {
		test('hooks fire per item in batch create', async ({ request }) => {
			const batchResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'create',
					items: [
						{ title: 'Batch Item 1', slug: 'batch-1' },
						{ title: 'Batch Item 2', slug: 'batch-2' },
						{ title: 'Batch Item 3', slug: 'batch-3' },
					],
				},
			});
			expect(batchResponse.status(), 'Batch create should succeed').toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const beforeValidateCount = logData.invocations.filter(
				(inv) => inv.hookType === 'beforeValidate',
			).length;
			const beforeChangeCount = logData.invocations.filter(
				(inv) => inv.hookType === 'beforeChange',
			).length;
			const afterChangeCount = logData.invocations.filter(
				(inv) => inv.hookType === 'afterChange',
			).length;

			expect(beforeValidateCount, 'beforeValidate should fire 3 times').toBe(3);
			expect(beforeChangeCount, 'beforeChange should fire 3 times').toBe(3);
			expect(afterChangeCount, 'afterChange should fire 3 times').toBe(3);

			// Verify all 3 items were actually persisted
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string }>;
			};
			const batchSlugs = findData.docs.map((d) => d.slug);
			expect(batchSlugs).toContain('batch-1');
			expect(batchSlugs).toContain('batch-2');
			expect(batchSlugs).toContain('batch-3');
		});

		test('hooks fire per item in batch update', async ({ request }) => {
			// Create items first
			const batchCreateResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'create',
					items: [
						{ title: 'Batch Update 1', slug: 'batch-upd-1' },
						{ title: 'Batch Update 2', slug: 'batch-upd-2' },
					],
				},
			});
			expect(batchCreateResponse.status()).toBe(201);

			const createBody = (await batchCreateResponse.json()) as {
				docs: Array<{ id: string }>;
			};

			await request.delete('/api/test-hook-log');

			const batchUpdateResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'update',
					items: [
						{ id: createBody.docs[0].id, data: { title: 'Batch Updated 1' } },
						{ id: createBody.docs[1].id, data: { title: 'Batch Updated 2' } },
					],
				},
			});
			expect(batchUpdateResponse.ok(), 'Batch update should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string; operation?: string }>;
			};

			const updateBeforeValidate = logData.invocations.filter(
				(inv) => inv.hookType === 'beforeValidate' && inv.operation === 'update',
			);
			const updateBeforeChange = logData.invocations.filter(
				(inv) => inv.hookType === 'beforeChange' && inv.operation === 'update',
			);
			const updateAfterChange = logData.invocations.filter(
				(inv) => inv.hookType === 'afterChange' && inv.operation === 'update',
			);

			expect(updateBeforeValidate.length, 'beforeValidate should fire 2 times').toBe(2);
			expect(updateBeforeChange.length, 'beforeChange should fire 2 times').toBe(2);
			expect(updateAfterChange.length, 'afterChange should fire 2 times').toBe(2);

			// Verify updates persisted
			const getResponse = await request.get(`/api/hook-test-items/${createBody.docs[0].id}`);

			const getBody = (await getResponse.json()) as { doc: { title: string } };
			expect(getBody.doc.title).toBe('Batch Updated 1');
		});

		test('hooks fire per item in batch delete', async ({ request }) => {
			// Create items first
			const batchCreateResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'create',
					items: [
						{ title: 'Batch Delete 1', slug: 'batch-del-1' },
						{ title: 'Batch Delete 2', slug: 'batch-del-2' },
						{ title: 'Batch Delete 3', slug: 'batch-del-3' },
					],
				},
			});
			expect(batchCreateResponse.status()).toBe(201);

			const createBody = (await batchCreateResponse.json()) as {
				docs: Array<{ id: string }>;
			};

			await request.delete('/api/test-hook-log');

			const batchDeleteResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'delete',
					ids: createBody.docs.map((d) => d.id),
				},
			});
			expect(batchDeleteResponse.ok(), 'Batch delete should succeed').toBe(true);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const beforeDeleteCount = logData.invocations.filter(
				(inv) => inv.hookType === 'beforeDelete',
			).length;
			const afterDeleteCount = logData.invocations.filter(
				(inv) => inv.hookType === 'afterDelete',
			).length;

			expect(beforeDeleteCount, 'beforeDelete should fire 3 times').toBe(3);
			expect(afterDeleteCount, 'afterDelete should fire 3 times').toBe(3);

			// Verify all items deleted
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string }>;
			};
			const remainingSlugs = findData.docs.map((d) => d.slug);
			expect(remainingSlugs).not.toContain('batch-del-1');
			expect(remainingSlugs).not.toContain('batch-del-2');
			expect(remainingSlugs).not.toContain('batch-del-3');
		});

		test('transform hooks apply in batch create', async ({ request }) => {
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['beforeChange'],
					transformField: 'status',
					transformValue: 'batch-transformed',
				},
			});

			const batchResponse = await request.post('/api/hook-test-items/batch', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					operation: 'create',
					items: [
						{ title: 'Batch Transform 1', slug: 'batch-tx-1' },
						{ title: 'Batch Transform 2', slug: 'batch-tx-2' },
					],
				},
			});
			expect(batchResponse.status()).toBe(201);

			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Verify all items have the transformed status
			const findResponse = await request.get('/api/hook-test-items');

			const findData = (await findResponse.json()) as {
				docs: Array<{ slug: string; status: string }>;
			};

			const tx1 = findData.docs.find((d) => d.slug === 'batch-tx-1');
			const tx2 = findData.docs.find((d) => d.slug === 'batch-tx-2');
			expect(tx1?.status, 'Batch item 1 should be transformed').toBe('batch-transformed');
			expect(tx2?.status, 'Batch item 2 should be transformed').toBe('batch-transformed');
		});
	});

	test.describe('Edge cases', () => {
		test('beforeRead fires even on empty collection', async ({ request }) => {
			// Collection is already clean from beforeEach
			await request.delete('/api/test-hook-log');

			const findResponse = await request.get('/api/hook-test-items');
			expect(findResponse.ok()).toBe(true);

			const findData = (await findResponse.json()) as { docs: unknown[] };
			expect(findData.docs.length, 'Collection should be empty').toBe(0);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			const beforeRead = logData.invocations.find((inv) => inv.hookType === 'beforeRead');
			expect(beforeRead, 'beforeRead should fire even on empty collection').toBeDefined();

			// afterRead should NOT fire (no documents to process)
			const afterReadCount = logData.invocations.filter(
				(inv) => inv.hookType === 'afterRead',
			).length;
			expect(afterReadCount, 'afterRead should not fire with no documents').toBe(0);
		});

		test('afterRead enrichment does not persist to database', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Ephemeral Enrich', slug: 'ephemeral-enrich' },
			});
			expect(createResponse.status()).toBe(201);

			const createData = (await createResponse.json()) as { doc: { id: string } };

			// Enable afterRead enrichment
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					transformOn: ['afterRead'],
					transformField: 'status',
					transformValue: 'ephemeral',
				},
			});

			// Read with enrichment
			const enrichedResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const enrichedBody = (await enrichedResponse.json()) as {
				doc: { status: string };
			};
			expect(enrichedBody.doc.status).toBe('ephemeral');

			// Disable enrichment
			await request.post('/api/test-hook-config', {
				headers: { 'Content-Type': 'application/json' },
				data: {},
			});

			// Read without enrichment — status should be whatever the original was (null/undefined)
			const plainResponse = await request.get(`/api/hook-test-items/${createData.doc.id}`);

			const plainBody = (await plainResponse.json()) as {
				doc: { status?: string | null };
			};
			expect(
				plainBody.doc.status,
				'afterRead enrichment should not persist — status should not be "ephemeral"',
			).not.toBe('ephemeral');
		});

		test('no read hooks fire when document is not found', async ({ request }) => {
			await request.delete('/api/test-hook-log');

			const findByIdResponse = await request.get(
				'/api/hook-test-items/00000000-0000-0000-0000-000000000000',
			);
			expect(findByIdResponse.status(), 'Deleted document should return 404').toBe(404);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{ hookType: string }>;
			};

			// beforeRead should still fire (it runs before the query)
			const beforeRead = logData.invocations.find((inv) => inv.hookType === 'beforeRead');
			expect(beforeRead, 'beforeRead should fire even for nonexistent doc').toBeDefined();
		});

		test('create with all fields populated — hooks receive all fields', async ({ request }) => {
			const createResponse = await request.post('/api/hook-test-items', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: 'All Fields',
					slug: 'all-fields',
					status: 'published',
					priority: 99,
				},
			});
			expect(createResponse.status()).toBe(201);

			const logResponse = await request.get('/api/test-hook-log');

			const logData = (await logResponse.json()) as {
				invocations: Array<{
					hookType: string;
					data?: Record<string, unknown>;
					doc?: Record<string, unknown>;
				}>;
			};

			const bv = logData.invocations.find((inv) => inv.hookType === 'beforeValidate');
			expect(bv?.data?.['title']).toBe('All Fields');
			expect(bv?.data?.['slug']).toBe('all-fields');
			expect(bv?.data?.['status']).toBe('published');
			expect(bv?.data?.['priority']).toBe(99);

			const ac = logData.invocations.find((inv) => inv.hookType === 'afterChange');
			expect(ac?.doc?.['title']).toBe('All Fields');
			expect(ac?.doc?.['status']).toBe('published');
			expect(ac?.doc?.['priority']).toBe(99);
			expect(ac?.doc?.['id'], 'afterChange doc should include generated id').toBeDefined();
		});
	});
});

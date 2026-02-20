import { test, expect, TEST_AUTHOR1_CREDENTIALS } from '../fixtures';

/**
 * Webhook E2E tests.
 * Verifies that webhooks are dispatched on collection CRUD events
 * and include correct payload/signature.
 */
test.describe('Webhooks', { tag: ['@api', '@hooks'] }, () => {
	test.beforeEach(async ({ request }) => {
		// Sign in
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author1 sign-in must succeed').toBe(true);

		// Clear any previous webhook data
		const clearResponse = await request.delete('/api/test-webhook-receiver');
		expect(clearResponse.ok()).toBe(true);
	});

	test('webhook is dispatched on create', async ({ request }) => {
		// Create a category
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Webhook Create Test', slug: 'webhook-create-test' },
		});
		expect(createResponse.status(), 'Category create should return 201').toBe(201);

		// Wait briefly for async webhook delivery
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Check the webhook receiver
		const receiverResponse = await request.get('/api/test-webhook-receiver');
		expect(receiverResponse.ok()).toBe(true);

		const data = (await receiverResponse.json()) as {
			webhooks: Array<{
				headers: Record<string, string>;
				body: {
					event: string;
					collection: string;
					operation: string;
					doc: Record<string, unknown>;
					timestamp: string;
				};
			}>;
			count: number;
		};

		// Should have at least one webhook for the create event
		expect(data.count).toBeGreaterThanOrEqual(1);

		const createWebhook = data.webhooks.find((w) => w.body.event === 'afterCreate');
		expect(createWebhook).toBeDefined();
		expect(createWebhook!.body.collection).toBe('categories');
		expect(createWebhook!.body.operation).toBe('create');
		expect(createWebhook!.body.doc).toBeDefined();
		expect(createWebhook!.body.timestamp).toBeDefined();

		// Verify webhook headers
		expect(createWebhook!.headers['x-momentum-event']).toBe('afterCreate');
		expect(createWebhook!.headers['x-momentum-collection']).toBe('categories');
		expect(createWebhook!.headers['x-momentum-signature']).toBeDefined();
		expect(createWebhook!.headers['x-momentum-delivery']).toBeDefined();

		// Clean up

		const created = (await createResponse.json()) as { doc: { id: string } };
		await request.delete(`/api/categories/${created.doc.id}`);
	});

	test('webhook is dispatched on update', async ({ request }) => {
		// Create a category first
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Webhook Update Test', slug: 'webhook-update-test' },
		});
		expect(createResponse.status(), 'Category create should return 201').toBe(201);

		const created = (await createResponse.json()) as { doc: { id: string } };

		// Clear webhooks from the create
		await request.delete('/api/test-webhook-receiver');

		// Update the category
		const updateResponse = await request.patch(`/api/categories/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Webhook Update Test Updated' },
		});
		expect(updateResponse.ok()).toBe(true);

		// Wait briefly for async webhook delivery
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Check the webhook receiver
		const receiverResponse = await request.get('/api/test-webhook-receiver');
		expect(receiverResponse.ok()).toBe(true);

		const data = (await receiverResponse.json()) as {
			webhooks: Array<{
				body: { event: string; operation: string };
			}>;
			count: number;
		};

		const updateWebhook = data.webhooks.find((w) => w.body.event === 'afterUpdate');
		expect(updateWebhook).toBeDefined();
		expect(updateWebhook!.body.operation).toBe('update');

		// Clean up
		await request.delete(`/api/categories/${created.doc.id}`);
	});

	test('webhook is dispatched on delete', async ({ request }) => {
		// Create a category first
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Webhook Delete Test', slug: 'webhook-delete-test' },
		});
		expect(createResponse.status(), 'Category create should return 201').toBe(201);

		const created = (await createResponse.json()) as { doc: { id: string } };

		// Clear webhooks from the create
		await request.delete('/api/test-webhook-receiver');

		// Delete the category
		const deleteResponse = await request.delete(`/api/categories/${created.doc.id}`);
		expect(deleteResponse.ok()).toBe(true);

		// Wait briefly for async webhook delivery
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Check the webhook receiver
		const receiverResponse = await request.get('/api/test-webhook-receiver');
		expect(receiverResponse.ok()).toBe(true);

		const data = (await receiverResponse.json()) as {
			webhooks: Array<{
				body: { event: string; operation: string };
			}>;
			count: number;
		};

		const deleteWebhook = data.webhooks.find((w) => w.body.event === 'afterDelete');
		expect(deleteWebhook).toBeDefined();
		expect(deleteWebhook!.body.operation).toBe('delete');
	});

	test('webhook signature is valid HMAC-SHA256', async ({ request }) => {
		const { createHmac } = await import('node:crypto');

		// Create a category to trigger webhook
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Webhook Sig Test', slug: 'webhook-sig-test' },
		});
		expect(createResponse.status(), 'Category create should return 201').toBe(201);

		// Wait for webhook delivery
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Get the webhook data
		const receiverResponse = await request.get('/api/test-webhook-receiver');

		const data = (await receiverResponse.json()) as {
			webhooks: Array<{
				headers: Record<string, string>;
				body: unknown;
			}>;
		};

		const webhook = data.webhooks.find((w) => {
			const body = w.body as { event?: string };
			return body.event === 'afterCreate';
		});
		expect(webhook).toBeDefined();

		const signature = webhook!.headers['x-momentum-signature'];
		expect(signature).toBeDefined();

		// Verify the signature matches HMAC-SHA256 of the body with the test secret
		const bodyStr = JSON.stringify(webhook!.body);
		const expectedSig = createHmac('sha256', 'test-webhook-secret').update(bodyStr).digest('hex');
		expect(signature).toBe(expectedSig);

		// Clean up

		const created = (await createResponse.json()) as { doc: { id: string } };
		await request.delete(`/api/categories/${created.doc.id}`);
	});
});

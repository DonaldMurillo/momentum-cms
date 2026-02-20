import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Event Bus E2E tests.
 * Verifies that the event bus plugin captures events when
 * collections are mutated via the API.
 */
test.describe('Event Bus', { tag: ['@api', '@hooks'] }, () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as admin
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok(), 'Admin sign-in must succeed').toBe(true);

		// Clear the event bus log
		const clear = await request.delete('/api/test-event-bus-log');
		expect(clear.ok()).toBe(true);
	});

	test('emits afterChange on create', async ({ request }) => {
		const slug = `eb-create-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Event Bus Create Test', slug },
		});
		expect(create.status()).toBe(201);

		const logResponse = await request.get('/api/test-event-bus-log');
		expect(logResponse.ok()).toBe(true);
		const log = (await logResponse.json()) as {
			events: Array<{ collection: string; event: string; operation: string }>;
			count: number;
		};

		const createEvent = log.events.find(
			(e) => e.collection === 'categories' && e.operation === 'create',
		);
		expect(createEvent).toBeDefined();
		expect(createEvent?.event).toBe('afterChange');
	});

	test('emits afterChange on update', async ({ request }) => {
		const slug = `eb-update-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Event Bus Update Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Clear log to isolate update event
		await request.delete('/api/test-event-bus-log');

		const update = await request.patch(`/api/categories/${doc.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Updated Name' },
		});
		expect(update.ok()).toBe(true);

		const logResponse = await request.get('/api/test-event-bus-log');
		const log = (await logResponse.json()) as {
			events: Array<{ collection: string; event: string; operation: string }>;
		};

		const updateEvent = log.events.find(
			(e) => e.collection === 'categories' && e.operation === 'update',
		);
		expect(updateEvent).toBeDefined();
		expect(updateEvent?.event).toBe('afterChange');
	});

	test('emits afterDelete on delete', async ({ request }) => {
		const slug = `eb-delete-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Event Bus Delete Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Clear log to isolate delete event
		await request.delete('/api/test-event-bus-log');

		const del = await request.delete(`/api/categories/${doc.doc.id}`);
		expect(del.ok()).toBe(true);

		const logResponse = await request.get('/api/test-event-bus-log');
		const log = (await logResponse.json()) as {
			events: Array<{ collection: string; event: string; operation: string }>;
		};

		const deleteEvent = log.events.find(
			(e) => e.collection === 'categories' && e.event === 'afterDelete',
		);
		expect(deleteEvent).toBeDefined();
		expect(deleteEvent?.operation).toBe('delete');
	});

	test('emits events for multiple collections', async ({ request }) => {
		const ts = Date.now();

		// Create in two different collections
		const catCreate = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: `Multi Col Test ${ts}`, slug: `multi-col-${ts}` },
		});
		expect(catCreate.status()).toBe(201);

		const articleCreate = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: `Multi Col Article ${ts}` },
		});
		expect(articleCreate.status()).toBe(201);

		const logResponse = await request.get('/api/test-event-bus-log');
		const log = (await logResponse.json()) as {
			events: Array<{ collection: string; event: string }>;
		};

		const collections = new Set(log.events.map((e) => e.collection));
		expect(collections.has('categories')).toBe(true);
		expect(collections.has('articles')).toBe(true);
	});
});

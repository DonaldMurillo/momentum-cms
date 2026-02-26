import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Analytics E2E tests.
 * Verifies that analytics tracks server-side collection events,
 * API request timing, and client-side ingest endpoint.
 */
test.describe('Analytics', { tag: ['@analytics', '@api'] }, () => {
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

		// Clear analytics events
		const clear = await request.delete('/api/test-analytics-events');
		expect(clear.ok()).toBe(true);
	});

	test('tracks collection create events', async ({ request }) => {
		const slug = `analytics-create-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Analytics Create Test', slug },
		});
		expect(create.status()).toBe(201);

		const response = await request.get('/api/test-analytics-events');
		expect(response.ok()).toBe(true);
		const data = (await response.json()) as {
			events: Array<{
				category: string;
				name: string;
				context: { collection?: string; source: string };
			}>;
		};

		const createEvent = data.events.find(
			(e) =>
				e.category === 'content' &&
				e.name === 'content_created' &&
				e.context.collection === 'categories',
		);
		expect(createEvent).toBeDefined();
		expect(createEvent?.context.source).toBe('server');
	});

	test('tracks collection update events', async ({ request }) => {
		const slug = `analytics-update-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Analytics Update Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Clear to isolate update event
		await request.delete('/api/test-analytics-events');

		const update = await request.patch(`/api/categories/${doc.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Updated Analytics Name' },
		});
		expect(update.ok()).toBe(true);

		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{ category: string; name: string }>;
		};

		const updateEvent = data.events.find(
			(e) => e.category === 'content' && e.name === 'content_updated',
		);
		expect(updateEvent).toBeDefined();
	});

	test('tracks collection delete events', async ({ request }) => {
		const slug = `analytics-delete-${Date.now()}`;
		const create = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Analytics Delete Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Clear to isolate delete event
		await request.delete('/api/test-analytics-events');

		const del = await request.delete(`/api/categories/${doc.doc.id}`);
		expect(del.ok()).toBe(true);

		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{ category: string; name: string }>;
		};

		const deleteEvent = data.events.find(
			(e) => e.category === 'content' && e.name === 'content_deleted',
		);
		expect(deleteEvent).toBeDefined();
	});

	test('tracks API request timing', async ({ request }) => {
		// Make an API request that the apiCollector will track
		const listResponse = await request.get('/api/categories');
		expect(listResponse.ok()).toBe(true);

		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{
				category: string;
				name: string;
				context: { statusCode?: number; duration?: number };
			}>;
		};

		const apiEvent = data.events.find((e) => e.category === 'api' && e.name === 'api_request');
		expect(apiEvent).toBeDefined();
		expect(apiEvent?.context.statusCode).toBe(200);
		expect(typeof apiEvent?.context.duration).toBe('number');
		expect(apiEvent?.context.duration).toBeGreaterThanOrEqual(0);  
	});

	test('ingest endpoint accepts client events', async ({ request }) => {
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				events: [
					{
						name: 'page_view',
						category: 'page',
						properties: { path: '/home' },
						context: { url: 'http://localhost/home' },
					},
				],
			},
		});
		expect(ingest.status()).toBe(202);
		const body = (await ingest.json()) as { accepted: number };
		expect(body.accepted).toBe(1);

		// Verify it shows up in the analytics store
		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{
				category: string;
				name: string;
				context: { source: string; url?: string };
			}>;
		};

		const pageEvent = data.events.find(
			(e) => e.category === 'page' && e.name === 'page_view' && e.context.source === 'client',
		);
		expect(pageEvent).toBeDefined();
		expect(pageEvent?.context.url).toBe('http://localhost/home');
	});

	test('ingest endpoint validates events', async ({ request }) => {
		// Missing required 'name' field
		const badRequest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events: [{}] },
		});
		expect(badRequest.status()).toBe(400);

		// Missing events array entirely
		const noEvents = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { foo: 'bar' },
		});
		expect(noEvents.status()).toBe(400);
	});

	test('ingest endpoint rate limits excessive requests', async ({ request }) => {
		// Rate limit is configured at 10 req/min per IP in momentum.config.ts.
		// Send 15 rapid requests — expect the ones beyond the limit to be 429.
		const results: number[] = [];
		for (let i = 0; i < 15; i++) {
			const res = await request.post('/api/analytics/collect', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					events: [{ name: `rate-test-${i}`, category: 'custom' }],
				},
			});
			results.push(res.status());
		}

		// At least one should be 429 (rate limited)
		expect(results).toContain(429);
		// At least one should be 202 (accepted)
		expect(results).toContain(202);
	});

	test('captures device and browser context in API events', async ({ request }) => {
		// Make an API request — the api-collector should parse the user-agent
		await request.get('/api/categories');

		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{
				category: string;
				name: string;
				context: {
					device?: string;
					browser?: string;
					os?: string;
					url?: string;
					ip?: string;
				};
			}>;
		};

		const apiEvent = data.events.find((e) => e.category === 'api' && e.name === 'api_request');
		expect(apiEvent).toBeDefined();

		// The api-collector should populate device/browser/os from user-agent
		expect(apiEvent?.context.device).toBeDefined();
		expect(apiEvent?.context.url).toBeDefined();
	});

	test('captures device and browser context in ingested events', async ({ request }) => {
		const ingest = await request.post('/api/analytics/collect', {
			headers: {
				'Content-Type': 'application/json',
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
			},
			data: {
				events: [
					{
						name: 'page_view',
						category: 'page',
						context: { url: 'http://localhost/test-ua' },
					},
				],
			},
		});
		expect(ingest.status()).toBe(202);

		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{
				name: string;
				context: {
					device?: string;
					browser?: string;
					os?: string;
					source: string;
				};
			}>;
		};

		const pageEvent = data.events.find(
			(e) => e.name === 'page_view' && e.context.source === 'client',
		);
		expect(pageEvent).toBeDefined();
		expect(pageEvent?.context.device).toBe('desktop');
		expect(pageEvent?.context.browser).toBe('Chrome');
		expect(pageEvent?.context.os).toBe('macOS');
	});

	test('excludes _seed_tracking from analytics', async ({ request }) => {
		// Seeding runs at startup and uses _seed_tracking collection internally.
		// Analytics should NOT track events from excluded collections.
		const response = await request.get('/api/test-analytics-events');
		const data = (await response.json()) as {
			events: Array<{ context: { collection?: string } }>;
		};

		const seedTrackingEvents = data.events.filter((e) => e.context.collection === '_seed_tracking');
		expect(seedTrackingEvents.length).toBe(0);
	});
});

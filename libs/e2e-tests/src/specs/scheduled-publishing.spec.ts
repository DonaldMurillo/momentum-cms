import { test, expect, TEST_AUTHOR2_CREDENTIALS } from '../fixtures';

/**
 * Scheduled Publishing E2E tests.
 * Verifies scheduling, cancellation, and automatic publishing via the background scheduler.
 */
test.describe('Scheduled publishing', () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR2_CREDENTIALS.email,
				password: TEST_AUTHOR2_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author2 sign-in must succeed').toBe(true);

		// Clean up leftover scheduled publishing test articles
		const listResponse = await request.get('/api/articles?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; title?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.title?.startsWith('SP-')) {
					await request.delete(`/api/articles/${doc.id}`);
				}
			}
		}
	});

	test('schedule-publish endpoint sets scheduledPublishAt', async ({ request }) => {
		// Create an article
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'SP-Schedule Test',
				content: '<p>To be scheduled</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Schedule for 1 hour in the future
		const futureDate = new Date(Date.now() + 3600000).toISOString();
		const scheduleResponse = await request.post(
			`/api/articles/${created.doc.id}/schedule-publish`,
			{
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: futureDate },
			},
		);
		expect(scheduleResponse.ok()).toBe(true);

		const scheduleData = (await scheduleResponse.json()) as {
			id: string;
			scheduledPublishAt: string;
		};
		expect(scheduleData.id).toBe(created.doc.id);
		expect(scheduleData.scheduledPublishAt).toBeTruthy();

		// Verify the document still has draft status (not published yet)
		const statusResponse = await request.get(`/api/articles/${created.doc.id}/status`);
		expect(statusResponse.ok()).toBe(true);

		const statusData = (await statusResponse.json()) as { status: string };
		expect(statusData.status).toBe('draft');
	});

	test('cancel-scheduled-publish clears scheduled date', async ({ request }) => {
		// Create and schedule an article
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'SP-Cancel Test' },
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Schedule
		const futureDate = new Date(Date.now() + 3600000).toISOString();
		const scheduleResponse = await request.post(
			`/api/articles/${created.doc.id}/schedule-publish`,
			{
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: futureDate },
			},
		);
		expect(scheduleResponse.ok()).toBe(true);

		// Cancel
		const cancelResponse = await request.post(
			`/api/articles/${created.doc.id}/cancel-scheduled-publish`,
		);
		expect(cancelResponse.ok()).toBe(true);

		const cancelData = (await cancelResponse.json()) as { message: string };
		expect(cancelData.message).toBe('Scheduled publish cancelled');
	});

	test('schedule-publish returns 400 when publishAt is missing', async ({ request }) => {
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'SP-Missing Date' },
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		const scheduleResponse = await request.post(
			`/api/articles/${created.doc.id}/schedule-publish`,
			{
				headers: { 'Content-Type': 'application/json' },
				data: {},
			},
		);
		expect(scheduleResponse.status()).toBe(400);
	});

	test('scheduler auto-publishes when scheduled time arrives', async ({ request }) => {
		// Create an article
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'SP-Auto Publish',
				content: '<p>Should be auto-published</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Schedule for 1 second in the past (should be picked up by scheduler immediately)
		const pastDate = new Date(Date.now() - 1000).toISOString();
		const scheduleResponse = await request.post(
			`/api/articles/${created.doc.id}/schedule-publish`,
			{
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: pastDate },
			},
		);
		expect(scheduleResponse.ok()).toBe(true);

		// Wait for the scheduler to pick it up (scheduler runs every 2s)
		// Poll the status for up to 10 seconds
		let published = false;
		for (let i = 0; i < 10; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const statusResponse = await request.get(`/api/articles/${created.doc.id}/status`);
			if (statusResponse.ok()) {
				const statusData = (await statusResponse.json()) as { status: string };
				if (statusData.status === 'published') {
					published = true;
					break;
				}
			}
		}

		expect(published, 'Document should be auto-published by scheduler').toBe(true);

		// Verify it also created a version
		const versionsResponse = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		expect(versionsResponse.ok()).toBe(true);

		const versionsData = (await versionsResponse.json()) as {
			docs: Array<{ id: string; _status: string }>;
		};
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(1);

		// The most recent version should be published
		const latestVersion = versionsData.docs[0];
		expect(latestVersion._status).toBe('published');
	});

	test('schedule-publish returns 400 for non-versioned collection', async ({ request }) => {
		const scheduleResponse = await request.post('/api/categories/some-id/schedule-publish', {
			headers: { 'Content-Type': 'application/json' },
			data: { publishAt: new Date().toISOString() },
		});
		expect(scheduleResponse.status()).toBe(400);
	});
});

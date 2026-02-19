import { test, expect, TEST_AUTHOR2_CREDENTIALS } from '../fixtures';

/**
 * Version diff E2E tests.
 * Verifies the compare versions API endpoint and version diff UI.
 *
 * Versions are created by explicit publish/draft operations, not by standard CRUD.
 */
test.describe('Version diff', { tag: ['@versioning', '@admin'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR2_CREDENTIALS.email,
				password: TEST_AUTHOR2_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author2 sign-in must succeed').toBe(true);

		// Clean up leftover diff test articles
		const listResponse = await request.get('/api/articles?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; title?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.title?.startsWith('VD-')) {
					await request.delete(`/api/articles/${doc.id}`);
				}
			}
		}
	});

	test('compare API returns field-level differences', async ({ request }) => {
		// Create an article
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-Compare API',
				content: '<p>Original content</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Publish the article to create version 1
		const publish1 = await request.post(`/api/articles/${created.doc.id}/publish`);
		expect(publish1.ok(), 'First publish must succeed').toBe(true);

		// Update the article
		const updateResponse = await request.patch(`/api/articles/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-Compare API Updated',
				content: '<p>Updated content</p>',
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Publish again to create version 2
		const publish2 = await request.post(`/api/articles/${created.doc.id}/publish`);
		expect(publish2.ok(), 'Second publish must succeed').toBe(true);

		// Get versions
		const versionsResponse = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		expect(versionsResponse.ok()).toBe(true);

		const versionsData = (await versionsResponse.json()) as {
			docs: Array<{ id: string }>;
		};
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(2);

		// Versions are newest-first
		const newestVersionId = versionsData.docs[0].id;
		const olderVersionId = versionsData.docs[1].id;

		// Compare versions
		const compareResponse = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				versionId1: olderVersionId,
				versionId2: newestVersionId,
			},
		});
		expect(compareResponse.ok()).toBe(true);

		const compareData = (await compareResponse.json()) as {
			differences: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
		};

		// Title should differ
		const titleDiff = compareData.differences.find((d) => d.field === 'title');
		expect(titleDiff).toBeDefined();
		expect(titleDiff?.oldValue).toBe('VD-Compare API');
		expect(titleDiff?.newValue).toBe('VD-Compare API Updated');

		// Content should differ
		const contentDiff = compareData.differences.find((d) => d.field === 'content');
		expect(contentDiff).toBeDefined();
	});

	test('compare API returns empty array for identical versions', async ({ request }) => {
		// Create an article
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-Identical',
				content: '<p>Same content</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Publish to create a version
		const publishResponse = await request.post(`/api/articles/${created.doc.id}/publish`);
		expect(publishResponse.ok(), 'Publish must succeed').toBe(true);

		// Get versions
		const versionsResponse = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		expect(versionsResponse.ok()).toBe(true);

		const versionsData = (await versionsResponse.json()) as {
			docs: Array<{ id: string }>;
		};
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(1);

		const versionId = versionsData.docs[0].id;

		// Compare a version with itself
		const compareResponse = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				versionId1: versionId,
				versionId2: versionId,
			},
		});
		expect(compareResponse.ok()).toBe(true);

		const compareData = (await compareResponse.json()) as {
			differences: Array<{ field: string }>;
		};
		expect(compareData.differences).toHaveLength(0);
	});

	test('compare API returns 400 when missing version IDs', async ({ request }) => {
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VD-Missing IDs' },
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		const compareResponse = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: 'some-id' },
		});
		expect(compareResponse.status()).toBe(400);
	});

	test('compare API returns 400 for non-versioned collection', async ({ request }) => {
		// Categories don't have versioning enabled
		const compareResponse = await request.post('/api/categories/some-id/versions/compare', {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: 'a', versionId2: 'b' },
		});
		expect(compareResponse.status()).toBe(400);
	});
});

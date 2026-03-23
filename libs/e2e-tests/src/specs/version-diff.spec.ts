import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Version diff E2E tests.
 * Verifies the compare versions API endpoint and version diff UI.
 *
 * Versions are created by explicit publish/draft operations, not by standard CRUD.
 * Uses admin credentials because publish requires hasRole('admin').
 */
test.describe('Version diff', { tag: ['@versioning', '@admin'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

		// Clean up leftover diff test articles and products
		for (const collection of ['articles', 'products']) {
			const listResponse = await request.get(`/api/${collection}?limit=1000`);
			if (listResponse.ok()) {
				const listData = (await listResponse.json()) as {
					docs: Array<{ id: string; title?: string; name?: string }>;
				};
				for (const doc of listData.docs) {
					const label = doc.title ?? doc.name ?? '';
					if (label.startsWith('VD-')) {
						await request.delete(`/api/${collection}/${doc.id}`);
					}
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
			differences: Array<{
				field: string;
				oldValue: unknown;
				newValue: unknown;
				changeType: string;
				fieldType?: string;
				label?: string;
				textDiff?: Array<{ type: string; value: string }>;
			}>;
		};

		// Title should differ with deep diff metadata
		const titleDiff = compareData.differences.find((d) => d.field === 'title');
		expect(titleDiff).toBeDefined();
		expect(titleDiff?.oldValue).toBe('VD-Compare API');
		expect(titleDiff?.newValue).toBe('VD-Compare API Updated');
		expect(titleDiff?.changeType).toBe('changed');
		expect(titleDiff?.fieldType).toBe('text');
		// Text fields include word-level diff
		expect(titleDiff?.textDiff).toBeDefined();
		expect(titleDiff?.textDiff?.length).toBeGreaterThan(0);

		// Content should differ
		const contentDiff = compareData.differences.find((d) => d.field === 'content');
		expect(contentDiff).toBeDefined();
		expect(contentDiff?.changeType).toBe('changed');
	});

	test('compare API returns all fields marked unchanged for identical versions', async ({
		request,
	}) => {
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
			differences: Array<{ field: string; changeType: string }>;
		};
		// Server must return at least one diff entry (all fields should be present)
		expect(compareData.differences.length).toBeGreaterThan(0);
		// All fields should be unchanged when comparing a version with itself
		const changes = compareData.differences.filter((d) => d.changeType !== 'unchanged');
		expect(changes).toHaveLength(0);
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

	test('diffExclude fields are excluded from compare API response', async ({ request }) => {
		// Articles have internalNotes with diffExclude: true
		const createRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-DiffExclude Test',
				content: '<p>Original</p>',
				internalNotes: 'secret-v1',
			},
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };

		// Publish to create version 1
		const pub1 = await request.post(`/api/articles/${created.doc.id}/publish`);
		expect(pub1.ok()).toBe(true);

		// Update all fields including the excluded one
		await request.patch(`/api/articles/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-DiffExclude Test Updated',
				content: '<p>Changed</p>',
				internalNotes: 'secret-v2',
			},
		});
		const pub2 = await request.post(`/api/articles/${created.doc.id}/publish`);
		expect(pub2.ok()).toBe(true);

		// Get versions
		const versionsRes = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		const versionsData = (await versionsRes.json()) as { docs: Array<{ id: string }> };
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(2);

		const [newer, older] = versionsData.docs;

		// Compare
		const compareRes = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: older.id, versionId2: newer.id },
		});
		expect(compareRes.ok()).toBe(true);

		const compareData = (await compareRes.json()) as {
			differences: Array<{ field: string; changeType: string }>;
		};

		// internalNotes must NOT appear in the diff response
		const excludedField = compareData.differences.find((d) => d.field === 'internalNotes');
		expect(excludedField).toBeUndefined();

		// title should still be present and changed
		const titleDiff = compareData.differences.find((d) => d.field === 'title');
		expect(titleDiff).toBeDefined();
		expect(titleDiff?.changeType).toBe('changed');
	});

	test('compare API returns text word-level diff for changed text fields', async ({ request }) => {
		const createRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VD-WordDiff Hello World', content: '<p>Original</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };

		await request.post(`/api/articles/${created.doc.id}/publish`);
		await request.patch(`/api/articles/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VD-WordDiff Hello Angular World' },
		});
		await request.post(`/api/articles/${created.doc.id}/publish`);

		const versionsRes = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		const versionsData = (await versionsRes.json()) as { docs: Array<{ id: string }> };
		const [newer, older] = versionsData.docs;

		const compareRes = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: older.id, versionId2: newer.id },
		});
		expect(compareRes.ok()).toBe(true);

		const compareData = (await compareRes.json()) as {
			differences: Array<{
				field: string;
				changeType: string;
				textDiff?: Array<{ type: string; value: string }>;
			}>;
		};

		const titleDiff = compareData.differences.find((d) => d.field === 'title');
		expect(titleDiff?.changeType).toBe('changed');
		expect(titleDiff?.textDiff).toBeDefined();
		expect(titleDiff?.textDiff?.length).toBeGreaterThan(0);

		// Should have at least one 'added' segment containing 'Angular'
		const addedSegments = titleDiff?.textDiff?.filter((s) => s.type === 'added') ?? [];
		expect(addedSegments.some((s) => s.value.includes('Angular'))).toBe(true);
	});

	test('compare API returns group children diffs for nested fields', async ({ request }) => {
		// Articles have a seo group with metaTitle and metaDescription
		const createRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'VD-GroupDiff Test',
				content: '<p>Content</p>',
				seo: { metaTitle: 'Original SEO Title', metaDescription: 'Original desc' },
			},
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };

		await request.post(`/api/articles/${created.doc.id}/publish`);
		await request.patch(`/api/articles/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { seo: { metaTitle: 'Updated SEO Title', metaDescription: 'Original desc' } },
		});
		await request.post(`/api/articles/${created.doc.id}/publish`);

		const versionsRes = await request.get(`/api/articles/${created.doc.id}/versions?limit=10`);
		const versionsData = (await versionsRes.json()) as { docs: Array<{ id: string }> };
		const [newer, older] = versionsData.docs;

		const compareRes = await request.post(`/api/articles/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: older.id, versionId2: newer.id },
		});
		expect(compareRes.ok()).toBe(true);

		const compareData = (await compareRes.json()) as {
			differences: Array<{
				field: string;
				changeType: string;
				fieldType?: string;
				children?: Array<{ field: string; changeType: string }>;
			}>;
		};

		const seoDiff = compareData.differences.find((d) => d.field === 'seo');
		expect(seoDiff).toBeDefined();
		expect(seoDiff?.fieldType).toBe('group');
		expect(seoDiff?.changeType).toBe('changed');
		expect(seoDiff?.children).toBeDefined();

		// metaTitle changed, metaDescription unchanged
		const metaTitleChild = seoDiff?.children?.find((c) => c.field === 'metaTitle');
		expect(metaTitleChild?.changeType).toBe('changed');

		const metaDescChild = seoDiff?.children?.find((c) => c.field === 'metaDescription');
		expect(metaDescChild?.changeType).toBe('unchanged');
	});

	test('compare API returns array item diffs for products with features', async ({ request }) => {
		// Products have versioning enabled with an array field (features) and group (seo)
		const createRes = await request.post('/api/products', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'VD-ArrayDiff Widget',
				price: 29.99,
				seo: { metaTitle: 'Widget SEO' },
				features: [
					{ label: 'Fast', description: 'Very fast', highlighted: true },
					{ label: 'Reliable', description: 'Always works', highlighted: false },
				],
			},
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };

		await request.post(`/api/products/${created.doc.id}/publish`);

		// Update: change a feature, add a new one
		await request.patch(`/api/products/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'VD-ArrayDiff Widget Pro',
				features: [
					{ label: 'Fast', description: 'Blazingly fast', highlighted: true },
					{ label: 'Reliable', description: 'Always works', highlighted: false },
					{ label: 'Secure', description: 'Enterprise grade', highlighted: true },
				],
			},
		});
		await request.post(`/api/products/${created.doc.id}/publish`);

		const versionsRes = await request.get(`/api/products/${created.doc.id}/versions?limit=10`);
		const versionsData = (await versionsRes.json()) as { docs: Array<{ id: string }> };
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(2);
		const [newer, older] = versionsData.docs;

		const compareRes = await request.post(`/api/products/${created.doc.id}/versions/compare`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId1: older.id, versionId2: newer.id },
		});
		expect(compareRes.ok()).toBe(true);

		const compareData = (await compareRes.json()) as {
			differences: Array<{
				field: string;
				changeType: string;
				fieldType?: string;
				arrayChanges?: Array<{
					index: number;
					changeType: string;
					children?: Array<{ field: string; changeType: string }>;
				}>;
			}>;
		};

		// name should be changed with text diff
		const nameDiff = compareData.differences.find((d) => d.field === 'name');
		expect(nameDiff?.changeType).toBe('changed');

		// features array should have changes
		const featuresDiff = compareData.differences.find((d) => d.field === 'features');
		expect(featuresDiff).toBeDefined();
		expect(featuresDiff?.fieldType).toBe('array');
		expect(featuresDiff?.changeType).toBe('changed');
		expect(featuresDiff?.arrayChanges).toBeDefined();
		expect(featuresDiff?.arrayChanges?.length).toBeGreaterThan(0);
	});
});

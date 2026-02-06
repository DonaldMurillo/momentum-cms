import { test, expect } from './fixtures';

/**
 * Versioning & Drafts E2E Tests
 *
 * Tests the versioning functionality with a real server (no mocks):
 * - Create versioned documents
 * - Publish/unpublish actions
 * - Version history listing
 * - Version restoration
 * - Draft saving
 * - Status endpoints
 */
test.describe.serial('Versioning API Tests', () => {
	let testArticleId: string;

	test('should create a versioned article', async ({ request }) => {
		const response = await request.post('/api/articles', {
			data: {
				title: 'Version Test Article',
				content: 'Initial content for version testing',
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.doc).toBeDefined();
		expect(data.doc.id).toBeDefined();
		testArticleId = data.doc.id;

		// Verify article is retrievable
		const getResponse = await request.get(`/api/articles/${testArticleId}`);
		expect(getResponse.ok()).toBeTruthy();
	});

	test('should get document status (default draft)', async ({ request }) => {
		const response = await request.get(`/api/articles/${testArticleId}/status`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.status).toBe('draft');
	});

	test('should publish document', async ({ request }) => {
		const response = await request.post(`/api/articles/${testArticleId}/publish`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Document published successfully');

		// Verify status changed
		const statusResponse = await request.get(`/api/articles/${testArticleId}/status`);
		const statusData = await statusResponse.json();
		expect(statusData.status).toBe('published');
	});

	test('should list versions after publish', async ({ request }) => {
		const response = await request.get(`/api/articles/${testArticleId}/versions`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.docs).toBeDefined();
		expect(Array.isArray(data.docs)).toBeTruthy();
		// Should have at least one version from the publish action
		expect(data.docs.length).toBeGreaterThanOrEqual(1);

		// Verify version structure
		const version = data.docs[0];
		expect(version.id).toBeDefined();
		expect(version.parent).toBe(testArticleId);
		expect(version._status).toBeDefined();
		expect(version.createdAt).toBeDefined();
	});

	test('should unpublish document', async ({ request }) => {
		const response = await request.post(`/api/articles/${testArticleId}/unpublish`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Document unpublished successfully');

		// Verify status changed back to draft
		const statusResponse = await request.get(`/api/articles/${testArticleId}/status`);
		const statusData = await statusResponse.json();
		expect(statusData.status).toBe('draft');
	});

	test('should save draft', async ({ request }) => {
		const response = await request.post(`/api/articles/${testArticleId}/draft`, {
			data: {
				title: 'Draft Updated Title',
				content: 'Draft updated content',
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Draft saved successfully');
		expect(data.version).toBeDefined();
		expect(data.version.autosave).toBe(true);

		// Verify the draft version has the correct content
		const versionResponse = await request.get(
			`/api/articles/${testArticleId}/versions/${data.version.id}`,
		);
		expect(versionResponse.ok()).toBeTruthy();
		const versionData = await versionResponse.json();
		expect(versionData.version.title).toBe('Draft Updated Title');
	});

	test('should get specific version by ID', async ({ request }) => {
		// First get the list of versions
		const listResponse = await request.get(`/api/articles/${testArticleId}/versions`);
		const listData = await listResponse.json();
		expect(listData.docs.length).toBeGreaterThan(0);

		const versionId = listData.docs[0].id;

		// Now get the specific version
		const response = await request.get(`/api/articles/${testArticleId}/versions/${versionId}`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.id).toBe(versionId);
		expect(data.version).toBeDefined();
	});

	test('should update article to create new state', async ({ request }) => {
		const response = await request.patch(`/api/articles/${testArticleId}`, {
			data: {
				title: 'Modified Title Before Restore',
				content: 'Modified content before restore',
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.doc.title).toBe('Modified Title Before Restore');
	});

	test('should restore version', async ({ request }) => {
		// Get versions
		const listResponse = await request.get(`/api/articles/${testArticleId}/versions`);
		const listData = await listResponse.json();
		expect(listData.docs.length).toBeGreaterThan(0);

		// Find a version that isn't the autosave draft
		const versionToRestore = listData.docs.find((v: Record<string, unknown>) => !v.autosave);
		expect(versionToRestore, 'Expected at least one non-autosave version').toBeDefined();

		// Restore version
		const response = await request.post(`/api/articles/${testArticleId}/versions/restore`, {
			data: {
				versionId: versionToRestore.id,
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Version restored successfully');
		expect(data.doc).toBeDefined();

		// Verify the article content actually reverted
		const getResponse = await request.get(`/api/articles/${testArticleId}`);
		expect(getResponse.ok()).toBeTruthy();
		const articleData = await getResponse.json();
		// After restoring, the title should no longer be "Modified Title Before Restore"
		expect(articleData.doc.title).not.toBe('Modified Title Before Restore');
	});

	test('should return 400 for non-versioned collection', async ({ request }) => {
		// Categories collection doesn't have versioning enabled
		const response = await request.get('/api/categories/some-id/versions');

		expect(response.status()).toBe(400);
		const data = await response.json();
		expect(data.error).toBe('Versioning not enabled');
	});

	test.afterAll(async ({ request }) => {
		if (testArticleId) {
			await request.delete(`/api/articles/${testArticleId}`);
		}
	});
});

test.describe('Versioning with Seeded Data', () => {
	test('should be able to publish seeded article', async ({ request }) => {
		// Get the seeded "Welcome Article"
		const listResponse = await request.get('/api/articles?limit=100');
		const listData = await listResponse.json();
		const welcomeArticle = listData.docs.find(
			(a: Record<string, unknown>) => a.title === 'Welcome Article',
		);

		expect(welcomeArticle, 'Seeded "Welcome Article" must exist').toBeDefined();

		// Publish the seeded article
		const publishResponse = await request.post(`/api/articles/${welcomeArticle.id}/publish`);
		expect(publishResponse.ok()).toBeTruthy();

		// Verify it's published
		const statusResponse = await request.get(`/api/articles/${welcomeArticle.id}/status`);
		const statusData = await statusResponse.json();
		expect(statusData.status).toBe('published');

		// Unpublish to restore original state
		await request.post(`/api/articles/${welcomeArticle.id}/unpublish`);
	});

	test('should list versions for seeded article after modifications', async ({ request }) => {
		// Get the seeded "Welcome Article"
		const listResponse = await request.get('/api/articles?limit=100');
		const listData = await listResponse.json();
		const welcomeArticle = listData.docs.find(
			(a: Record<string, unknown>) => a.title === 'Welcome Article',
		);

		expect(welcomeArticle, 'Seeded "Welcome Article" must exist').toBeDefined();

		const versionsResponse = await request.get(`/api/articles/${welcomeArticle.id}/versions`);
		expect(versionsResponse.ok()).toBeTruthy();

		const versionsData = await versionsResponse.json();
		expect(versionsData.docs).toBeDefined();
		expect(Array.isArray(versionsData.docs)).toBeTruthy();
	});
});

import { test, expect } from './fixtures/auth.fixture';
import { APIRequestContext } from '@playwright/test';

/**
 * Versioning & Drafts E2E Tests
 *
 * Tests the versioning functionality with a real server (no mocks):
 * - Publish/unpublish actions
 * - Version history display
 * - Version restoration
 * - Draft saving
 * - Status badges
 */

// Helper to get authenticated request context from the auth page
async function getAuthRequest(
	authenticatedPage: import('@playwright/test').Page,
): Promise<APIRequestContext> {
	return authenticatedPage.request;
}

test.describe('Versioning - API Tests', () => {
	test.describe.configure({ mode: 'serial' });

	let testPostId: string;

	test('should create a versioned post via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.post('/api/posts', {
			data: {
				title: 'E2E Version Test Post',
				slug: `e2e-version-test-${Date.now()}`,
				content: 'Initial content for version testing',
				status: 'draft',
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.doc).toBeDefined();
		expect(data.doc.id).toBeDefined();
		testPostId = data.doc.id;
	});

	test('should get document status via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.get(`/api/posts/${testPostId}/status`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.status).toBe('draft');
	});

	test('should publish document via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.post(`/api/posts/${testPostId}/publish`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Document published successfully');

		// Verify status changed
		const statusResponse = await request.get(`/api/posts/${testPostId}/status`);
		const statusData = await statusResponse.json();
		expect(statusData.status).toBe('published');
	});

	test('should unpublish document via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.post(`/api/posts/${testPostId}/unpublish`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Document unpublished successfully');

		// Verify status changed back to draft
		const statusResponse = await request.get(`/api/posts/${testPostId}/status`);
		const statusData = await statusResponse.json();
		expect(statusData.status).toBe('draft');
	});

	test('should list versions via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.get(`/api/posts/${testPostId}/versions`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.docs).toBeDefined();
		expect(Array.isArray(data.docs)).toBeTruthy();
		// Should have at least one version from the publish action
		expect(data.docs.length).toBeGreaterThanOrEqual(1);
	});

	test('should save draft via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		const response = await request.post(`/api/posts/${testPostId}/draft`, {
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
	});

	test('should get specific version via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		// First get the list of versions
		const listResponse = await request.get(`/api/posts/${testPostId}/versions`);
		const listData = await listResponse.json();
		expect(listData.docs.length).toBeGreaterThan(0);

		const versionId = listData.docs[0].id;

		// Now get the specific version
		const response = await request.get(`/api/posts/${testPostId}/versions/${versionId}`);

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.id).toBe(versionId);
		expect(data.version).toBeDefined();
	});

	test('should restore version via API', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		// First, update the post to create a new state
		await request.patch(`/api/posts/${testPostId}`, {
			data: {
				title: 'Modified Title Before Restore',
			},
		});

		// Get versions
		const listResponse = await request.get(`/api/posts/${testPostId}/versions`);
		const listData = await listResponse.json();
		expect(listData.docs.length).toBeGreaterThan(0);

		// Find a version that isn't the current one (not autosave if possible)
		const versionToRestore =
			listData.docs.find((v: Record<string, unknown>) => !v.autosave) || listData.docs[0];

		// Restore version
		const response = await request.post(`/api/posts/${testPostId}/versions/restore`, {
			data: {
				versionId: versionToRestore.id,
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toBe('Version restored successfully');
		expect(data.doc).toBeDefined();
	});

	test('should return 400 for non-versioned collection', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		// Users collection doesn't have versioning enabled
		const response = await request.get('/api/users/some-id/versions');

		expect(response.status()).toBe(400);
		const data = await response.json();
		expect(data.error).toBe('Versioning not enabled');
	});

	test('should cleanup test post', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		if (testPostId) {
			const response = await request.delete(`/api/posts/${testPostId}`);
			expect(response.ok()).toBeTruthy();
		}
	});
});

test.describe('Versioning - UI Tests', () => {
	test.describe.configure({ mode: 'serial' });

	let testPostId: string;

	test('should create test post for UI tests', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		// Create a test post via API
		const testSlug = `e2e-ui-version-test-${Date.now()}`;
		const response = await request.post('/api/posts', {
			data: {
				title: 'E2E UI Version Test Post',
				slug: testSlug,
				content: 'Content for UI version testing',
				status: 'draft',
			},
		});

		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.doc).toBeDefined();
		testPostId = data.doc.id;
	});

	test('should display publish controls on entity view', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for content to load - use heading for specificity
		await expect(
			authenticatedPage.getByRole('heading', { name: 'E2E UI Version Test Post' }),
		).toBeVisible();

		// Should show status badge
		const statusBadge = authenticatedPage.locator('mcms-badge').first();
		await expect(statusBadge).toBeVisible();
		await expect(statusBadge).toContainText(/draft/i);

		// Should show publish button for draft documents
		const publishButton = authenticatedPage.getByRole('button', { name: /publish/i });
		await expect(publishButton).toBeVisible();
	});

	test('should publish document from entity view', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for content to load
		await expect(
			authenticatedPage.getByRole('heading', { name: 'E2E UI Version Test Post' }),
		).toBeVisible();

		// Click publish
		const publishButton = authenticatedPage.getByRole('button', { name: /^publish$/i });
		await expect(publishButton).toBeVisible();
		await publishButton.click();

		// Wait for the publish to complete and UI to update
		await authenticatedPage.waitForTimeout(1000);

		// Should now show "Published" status and "Unpublish" button
		const statusBadge = authenticatedPage.locator('mcms-badge').first();
		await expect(statusBadge).toContainText(/published/i);

		const unpublishButton = authenticatedPage.getByRole('button', { name: /unpublish/i });
		await expect(unpublishButton).toBeVisible();
	});

	test('should unpublish document from entity view', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for content to load
		await expect(
			authenticatedPage.getByRole('heading', { name: 'E2E UI Version Test Post' }),
		).toBeVisible();

		// Click unpublish
		const unpublishButton = authenticatedPage.getByRole('button', { name: /unpublish/i });
		await expect(unpublishButton).toBeVisible();
		await unpublishButton.click();

		// Should show confirmation dialog
		const confirmButton = authenticatedPage.getByRole('button', { name: /^unpublish$/i }).last();
		await expect(confirmButton).toBeVisible();
		await confirmButton.click();

		// Wait for the unpublish to complete and UI to update
		await authenticatedPage.waitForTimeout(1000);

		// Should now show "Draft" status and "Publish" button again
		const statusBadge = authenticatedPage.locator('mcms-badge').first();
		await expect(statusBadge).toContainText(/draft/i);

		const publishButton = authenticatedPage.getByRole('button', { name: /^publish$/i });
		await expect(publishButton).toBeVisible();
	});

	test('should display version history widget', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for content to load
		await expect(
			authenticatedPage.getByRole('heading', { name: 'E2E UI Version Test Post' }),
		).toBeVisible();

		// Should show version history section
		const versionHistoryHeading = authenticatedPage.getByRole('heading', {
			name: /version history/i,
		});
		await expect(versionHistoryHeading).toBeVisible();

		// Should show at least one version entry
		const versionCard = authenticatedPage.locator('mcms-version-history mcms-card-content');
		await expect(versionCard).toBeVisible();
	});

	test('should show Save Draft button in edit form', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}/edit`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for form to load
		await expect(authenticatedPage.locator('input#title')).toBeVisible();

		// Should have Save Draft button (versioning is enabled with drafts)
		const saveDraftButton = authenticatedPage.getByRole('button', { name: /save draft/i });
		await expect(saveDraftButton).toBeVisible();

		// Should also have Save Changes button
		const saveChangesButton = authenticatedPage.getByRole('button', { name: /save changes/i });
		await expect(saveChangesButton).toBeVisible();
	});

	test('should save draft from edit form', async ({ authenticatedPage }) => {
		await authenticatedPage.goto(`/admin/collections/posts/${testPostId}/edit`);
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for form to load
		const titleInput = authenticatedPage.locator('input#title');
		await expect(titleInput).toBeVisible();

		// Modify the title
		await titleInput.clear();
		await titleInput.fill('Draft Save Test Title');

		// Click Save Draft
		const saveDraftButton = authenticatedPage.getByRole('button', { name: /save draft/i });
		await saveDraftButton.click();

		// Should show success toast
		await expect(authenticatedPage.getByText(/draft saved/i)).toBeVisible({ timeout: 5000 });
	});

	test('should cleanup UI test post', async ({ authenticatedPage }) => {
		const request = await getAuthRequest(authenticatedPage);
		if (testPostId) {
			const response = await request.delete(`/api/posts/${testPostId}`);
			expect(response.ok()).toBeTruthy();
		}
	});
});

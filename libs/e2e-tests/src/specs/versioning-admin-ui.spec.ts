import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Versioning & Drafts Admin UI E2E Tests
 *
 * Tests the versioning UI from the admin dashboard — status column, filters,
 * publish controls, and version history. All navigation starts from /admin
 * and uses sidebar/dashboard navigation, never deep-links directly.
 *
 * Uses authenticatedPage (admin) and editorPage for multi-user scenarios.
 */

async function signInApi(
	request: APIRequestContext,
	credentials: { email: string; password: string },
): Promise<void> {
	const res = await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: { email: credentials.email, password: credentials.password },
	});
	expect(res.ok(), `Sign-in for ${credentials.email} must succeed`).toBe(true);
}

/** Navigate from admin dashboard to articles list via sidebar. */
async function navigateToArticlesList(page: Page): Promise<void> {
	await page.goto('/admin');
	await page.waitForLoadState('domcontentloaded');

	// Click "Articles" in the sidebar or dashboard
	const articlesLink = page
		.locator('a, button')
		.filter({ hasText: /^Articles$/i })
		.first();
	await expect(articlesLink).toBeVisible({ timeout: 15000 });
	await articlesLink.click();

	// Wait for collection list to load
	await expect(page.locator('mcms-data-table, mcms-table-body').first()).toBeVisible({
		timeout: 15000,
	});
}

test.describe('Versioning Admin UI', { tag: ['@versioning', '@multi-user', '@admin'] }, () => {
	let testArticleId: string;

	test.beforeAll(async ({ request }) => {
		await signInApi(request, TEST_CREDENTIALS);

		// Ensure we have a published article for testing
		const createRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VUI-Published Article', content: '<p>Published content</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		testArticleId = created.doc.id;

		// Publish it
		const publishRes = await request.post(`/api/articles/${testArticleId}/publish`);
		expect(publishRes.ok()).toBe(true);

		// Also create a draft article
		const draftRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VUI-Draft Article', content: '<p>Draft content</p>' },
		});
		expect(draftRes.status()).toBe(201);
	});

	test.afterAll(async ({ request }) => {
		await signInApi(request, TEST_CREDENTIALS);
		const listRes = await request.get('/api/articles?limit=1000');
		if (listRes.ok()) {
			const listData = (await listRes.json()) as {
				docs: Array<{ id: string; title?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.title?.startsWith('VUI-')) {
					await request.delete(`/api/articles/${doc.id}`);
				}
			}
		}
	});

	test('articles list shows status column for versioned collections', async ({
		authenticatedPage: page,
	}) => {
		await navigateToArticlesList(page);

		// The Status column header should be visible
		const statusHeader = page.locator('mcms-table-header, thead').getByText('Status');
		await expect(statusHeader).toBeVisible({ timeout: 10000 });

		// Should see badge cells with "Draft" or "Published"
		const badges = page.locator('mcms-badge, [class*="badge"]');
		await expect(badges.first()).toBeVisible({ timeout: 10000 });

		// At least one cell should contain "Draft" or "Published"
		const statusTexts = await badges.allTextContents();
		const hasStatusBadge = statusTexts.some(
			(t) => t.trim() === 'Draft' || t.trim() === 'Published',
		);
		expect(hasStatusBadge, 'Should show Draft or Published status badges').toBe(true);
	});

	test('status filter buttons are visible and functional', async ({ authenticatedPage: page }) => {
		await navigateToArticlesList(page);

		// Status filter buttons should be visible
		const allFilter = page.locator('[data-testid="status-filter-all"]');
		const draftFilter = page.locator('[data-testid="status-filter-draft"]');
		const publishedFilter = page.locator('[data-testid="status-filter-published"]');

		await expect(allFilter).toBeVisible({ timeout: 10000 });
		await expect(draftFilter).toBeVisible();
		await expect(publishedFilter).toBeVisible();

		// Click "Published" filter and wait for API response
		await Promise.all([
			page.waitForResponse((res) => res.url().includes('/api/articles') && res.ok()),
			publishedFilter.click(),
		]);

		// Wait for table to re-render with only Published badges
		await expect
			.poll(
				async () => {
					const badges = page.locator('mcms-table-body mcms-badge, tbody [class*="badge"]');
					const texts = await badges.allTextContents();
					const statuses = texts
						.map((t) => t.trim())
						.filter((t) => t === 'Draft' || t === 'Published');
					if (statuses.length === 0) return 'no-badges';
					if (statuses.every((s) => s === 'Published')) return 'all-published';
					return `mixed: ${statuses.join(',')}`;
				},
				{ timeout: 10000, message: 'Expected only Published badges after filtering' },
			)
			.toBe('all-published');

		// Click "Draft" filter and wait for API response
		await Promise.all([
			page.waitForResponse((res) => res.url().includes('/api/articles') && res.ok()),
			draftFilter.click(),
		]);

		// Wait for table to re-render with only Draft badges
		await expect
			.poll(
				async () => {
					const badges = page.locator('mcms-table-body mcms-badge, tbody [class*="badge"]');
					const texts = await badges.allTextContents();
					const statuses = texts
						.map((t) => t.trim())
						.filter((t) => t === 'Draft' || t === 'Published');
					if (statuses.length === 0) return 'no-badges';
					if (statuses.every((s) => s === 'Draft')) return 'all-draft';
					return `mixed: ${statuses.join(',')}`;
				},
				{ timeout: 10000, message: 'Expected only Draft badges after filtering' },
			)
			.toBe('all-draft');

		// Click "All" to reset
		await allFilter.click();
	});

	test('admin sees publish controls on article edit page', async ({ authenticatedPage: page }) => {
		// Navigate to the published test article's edit page
		await page.goto(`/admin/collections/articles/${testArticleId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Publish controls should be visible
		const publishControls = page.locator('mcms-publish-controls');
		await expect(publishControls).toBeVisible({ timeout: 15000 });

		// Should show "Published" badge and "Unpublish" button
		await expect(publishControls.getByText('Published')).toBeVisible();
		await expect(publishControls.getByText('Unpublish')).toBeVisible();
	});

	test('version history card displays on edit page', async ({ authenticatedPage: page }) => {
		// Navigate to article edit page (article was published so it has versions)
		await page.goto(`/admin/collections/articles/${testArticleId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Version History card should be visible
		const versionHistory = page.locator('mcms-version-history');
		await expect(versionHistory).toBeVisible({ timeout: 15000 });

		// Should show "Version History" heading
		await expect(versionHistory.getByText('Version History')).toBeVisible();

		// Should have at least one version entry
		const versionEntries = versionHistory.locator('mcms-badge');
		await expect(versionEntries.first()).toBeVisible({ timeout: 10000 });
	});

	test('admin can publish via UI and status updates', async ({
		authenticatedPage: page,
		request,
	}) => {
		// Create a fresh draft article via API
		await signInApi(request, TEST_CREDENTIALS);
		const createRes = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VUI-Publish Via UI', content: '<p>Will be published</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };

		// Navigate to edit page
		await page.goto(`/admin/collections/articles/${created.doc.id}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Should show "Draft" status and "Publish" button
		const publishControls = page.locator('mcms-publish-controls');
		await expect(publishControls).toBeVisible({ timeout: 15000 });
		await expect(publishControls.getByText('Draft')).toBeVisible();

		// Click Publish
		const publishButton = publishControls.getByRole('button', { name: 'Publish' });
		await expect(publishButton).toBeVisible();
		await publishButton.click();

		// Status should change to "Published"
		await expect(publishControls.getByText('Published')).toBeVisible({ timeout: 10000 });

		// Unpublish button should now be visible
		await expect(publishControls.getByText('Unpublish')).toBeVisible();

		// Verify backend state matches UI
		const statusResponse = await request.get(`/api/articles/${created.doc.id}/status`);
		expect(statusResponse.ok()).toBe(true);
		const statusData = (await statusResponse.json()) as { status: string };
		expect(statusData.status, 'Backend status should match UI').toBe('published');
	});
});

import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Admin Edit Page with Preview - Stability Tests
 *
 * Verifies that the edit page with live preview iframe renders correctly
 * and remains stable (no crash, no blank page) for collections with
 * URL-based preview (articles, pages).
 *
 * These tests use real DOM interaction: navigate from list → view → edit,
 * and verify the page stays alive after the preview iframe loads.
 */

async function signIn(request: APIRequestContext): Promise<void> {
	const res = await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: {
			email: TEST_CREDENTIALS.email,
			password: TEST_CREDENTIALS.password,
		},
	});
	expect(res.ok(), 'Admin sign-in must succeed').toBe(true);
}

test.describe('Admin Edit Page with Preview', { tag: ['@admin', '@blocks'] }, () => {
	test('article edit page shows preview iframe without crashing', async ({
		authenticatedPage: page,
		request,
	}) => {
		await signIn(request);

		// Get first published article
		const res = await request.get('/api/articles?where[_status][equals]=published&limit=1');
		expect(res.ok()).toBe(true);
		const body = (await res.json()) as { docs: Array<{ id: string }> };
		expect(body.docs.length).toBeGreaterThan(0);
		const articleId = body.docs[0].id;

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		// Navigate directly to the edit page
		await page.goto(`/admin/collections/articles/${articleId}/edit`);

		// The form heading should appear (may say "Edit" or "View" depending on permissions timing)
		const heading = page.locator('main h1').first();
		await expect(heading).toBeVisible({ timeout: 15000 });

		// The preview layout (split view) should appear
		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		// The preview iframe should exist and be visible (appears after entity data loads)
		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 20000 });

		// Wait 5 seconds to confirm the page doesn't crash
		await page.waitForTimeout(5000); // intentional: proving NO crash occurs

		// Page should still be alive
		await expect(heading).toBeVisible();
		await expect(iframe).toBeVisible({ timeout: 15000 });

		// No JS errors should have occurred
		expect(pageErrors, 'No page errors during preview load').toEqual([]);
	});

	test('page edit page shows preview iframe without crashing', async ({
		authenticatedPage: page,
		request,
	}) => {
		await signIn(request);

		const res = await request.get('/api/pages?where[slug][equals]=home&limit=1');
		expect(res.ok()).toBe(true);
		const body = (await res.json()) as { docs: Array<{ id: string }> };
		expect(body.docs.length).toBeGreaterThan(0);
		const pageId = body.docs[0].id;

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.goto(`/admin/collections/pages/${pageId}/edit`);

		const heading = page.locator('main h1').first();
		await expect(heading).toBeVisible({ timeout: 15000 });

		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 10000 });

		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 15000 });

		// Wait 5 seconds to confirm no crash
		await page.waitForTimeout(5000); // intentional: proving NO crash occurs

		await expect(heading).toBeVisible();
		await expect(iframe).toBeVisible({ timeout: 15000 });
		expect(pageErrors, 'No page errors during preview load').toEqual([]);
	});

	test('SPA navigation: list → view → edit with preview stays stable', async ({
		authenticatedPage: page,
		request,
	}) => {
		await signIn(request);

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		// Start at the articles collection list
		await page.goto('/admin/collections/articles');
		await page.waitForLoadState('domcontentloaded');

		// Wait for table rows to appear
		const firstRow = page.locator('mcms-table-body mcms-table-row').first();
		await expect(firstRow).toBeVisible({ timeout: 15000 });

		// Click the first row → navigates to view page
		await firstRow.click();
		await expect(page).toHaveURL(/\/admin\/collections\/articles\/[a-f0-9-]+$/, {
			timeout: 10000,
		});

		// Wait for view page to render
		const heading = page.locator('main h1').first();
		await expect(heading).toBeVisible({ timeout: 15000 });

		// Click the Edit button → navigates to edit page
		const editButton = page.locator('button', { hasText: 'Edit' });
		await expect(editButton).toBeVisible({ timeout: 5000 });
		await editButton.click();

		// Should be on the edit page
		await expect(page).toHaveURL(/\/admin\/collections\/articles\/[a-f0-9-]+\/edit$/, {
			timeout: 10000,
		});

		// Form heading should appear
		await expect(heading).toBeVisible({ timeout: 15000 });

		// Preview layout should appear (articles collection has preview config)
		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 10000 });

		// Preview iframe should be visible
		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 15000 });

		// Wait 5 seconds to confirm no crash
		await page.waitForTimeout(5000); // intentional: proving NO crash occurs

		// Page should still be alive
		await expect(heading).toBeVisible();
		await expect(iframe).toBeVisible({ timeout: 15000 });
		expect(pageErrors, 'No page errors during SPA navigation to edit').toEqual([]);
	});

	test('preview Refresh button works without crash', async ({
		authenticatedPage: page,
		request,
	}) => {
		await signIn(request);

		const res = await request.get('/api/articles?where[_status][equals]=published&limit=1');
		expect(res.ok()).toBe(true);
		const body = (await res.json()) as { docs: Array<{ id: string }> };
		expect(body.docs.length).toBeGreaterThan(0);

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.goto(`/admin/collections/articles/${body.docs[0].id}/edit`);

		const heading = page.locator('main h1').first();
		await expect(heading).toBeVisible({ timeout: 15000 });

		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 10000 });

		// Click the Refresh button
		const refreshBtn = page.locator('[data-testid="preview-refresh"]');
		await expect(refreshBtn).toBeVisible();
		await refreshBtn.click();

		// Wait for iframe to reload
		await page.waitForTimeout(3000); // intentional: waiting for iframe reload

		// Page should still be alive
		await expect(heading).toBeVisible();
		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 15000 });
		expect(pageErrors, 'No page errors after refresh').toEqual([]);
	});

	test('Hide/Show preview toggle works', async ({ authenticatedPage: page, request }) => {
		await signIn(request);

		const res = await request.get('/api/articles?where[_status][equals]=published&limit=1');
		expect(res.ok()).toBe(true);
		const body = (await res.json()) as { docs: Array<{ id: string }> };
		expect(body.docs.length).toBeGreaterThan(0);

		await page.goto(`/admin/collections/articles/${body.docs[0].id}/edit`);

		const heading = page.locator('main h1').first();
		await expect(heading).toBeVisible({ timeout: 15000 });

		// Preview layout should be visible initially
		await expect(page.locator('[data-testid="preview-layout"]')).toBeVisible({ timeout: 10000 });

		// Click "Hide Preview"
		const hideBtn = page.locator('[data-testid="preview-toggle"]');
		await expect(hideBtn).toBeVisible();
		await expect(hideBtn).toContainText('Hide Preview');
		await hideBtn.click();

		// Preview layout should disappear, but form should still be visible
		await expect(page.locator('[data-testid="preview-layout"]')).not.toBeVisible({
			timeout: 10000,
		});
		await expect(heading).toBeVisible({ timeout: 10000 });

		// Click "Show Preview"
		const showBtn = page.locator('[data-testid="preview-toggle"]');
		await expect(showBtn).toBeVisible();
		await expect(showBtn).toContainText('Show Preview');
		await showBtn.click();

		// Preview layout should reappear
		await expect(page.locator('[data-testid="preview-layout"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible();
	});
});

import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Admin Collection View Page E2E tests.
 *
 * Verifies that navigating to the collection view page renders correctly
 * and remains stable. Tests both direct URL navigation and SPA in-page
 * navigation from the collection list.
 *
 * The view page is read-only and shows an "Open Page" link for collections
 * with preview configured (instead of an iframe, which is on the edit page).
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

test.describe('Admin Collection View', { tag: ['@admin'] }, () => {
	test.describe('Articles collection', () => {
		let articleId: string;

		test.beforeAll(async ({ request }) => {
			await signIn(request);
			const res = await request.get('/api/articles?where[_status][equals]=published&limit=1');
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as { docs: Array<{ id: string }> };
			expect(body.docs.length).toBeGreaterThan(0);
			articleId = body.docs[0].id;
		});

		test('view page renders entity details via direct URL', async ({ authenticatedPage: page }) => {
			await page.goto(`/admin/collections/articles/${articleId}`);
			await page.waitForLoadState('domcontentloaded');

			// Entity view heading should appear inside the main content area
			const heading = page.locator('main h1').first();
			await expect(heading).toBeVisible({ timeout: 15000 });
			await expect(heading).not.toHaveText('Momentum CMS');

			// Should NOT have a preview iframe (view page is read-only)
			await expect(page.locator('[data-testid="preview-iframe"]')).not.toBeVisible();

			// "Open Page" link should be visible for articles with preview config
			const openPageLink = page.locator('[data-testid="open-page-link"]');
			await expect(openPageLink).toBeVisible({ timeout: 10000 });
			await expect(openPageLink).toHaveAttribute('href', /\/articles\/.+/);

			// Page should remain stable for 3 seconds (no crash/blank)
			const errors: string[] = [];
			page.on('pageerror', (err) => errors.push(err.message));

			await new Promise<void>((resolve) => setTimeout(resolve, 3000)); // negative proof: page remains stable (no crash)
			await expect(heading).toBeVisible();
			expect(errors).toEqual([]);
		});

		test('view page renders via SPA navigation from list', async ({ authenticatedPage: page }) => {
			await page.goto('/admin/collections/articles');
			await page.waitForLoadState('domcontentloaded');

			// Wait for the table to render with rows
			const firstRow = page.locator('mcms-table-body mcms-table-row').first();
			await expect(firstRow).toBeVisible({ timeout: 15000 });

			// Click the first row (SPA navigation to view page)
			await firstRow.click();

			// Should navigate to the view page
			await expect(page).toHaveURL(/\/admin\/collections\/articles\/[a-f0-9-]+$/, {
				timeout: 10000,
			});

			// Entity view heading should appear
			const heading = page.locator('main h1').first();
			await expect(heading).toBeVisible({ timeout: 15000 });
			await expect(heading).not.toHaveText('Momentum CMS');

			// Page should remain stable for 3 seconds
			const errors: string[] = [];
			page.on('pageerror', (err) => errors.push(err.message));

			await new Promise<void>((resolve) => setTimeout(resolve, 3000)); // negative proof: page remains stable (no crash)
			await expect(heading).toBeVisible();
			expect(errors).toEqual([]);
		});
	});

	test.describe('Pages collection', () => {
		let pageId: string;

		test.beforeAll(async ({ request }) => {
			await signIn(request);
			const res = await request.get('/api/pages?where[slug][equals]=home&limit=1');
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as { docs: Array<{ id: string }> };
			expect(body.docs.length).toBeGreaterThan(0);
			pageId = body.docs[0].id;
		});

		test('view page renders entity details via direct URL', async ({ authenticatedPage: page }) => {
			await page.goto(`/admin/collections/pages/${pageId}`);
			await page.waitForLoadState('domcontentloaded');

			const heading = page.locator('main h1').first();
			await expect(heading).toBeVisible({ timeout: 15000 });
			await expect(heading).not.toHaveText('Momentum CMS');

			// No preview iframe on view page
			await expect(page.locator('[data-testid="preview-iframe"]')).not.toBeVisible();

			// "Open Page" link should work for pages with preview config
			const openPageLink = page.locator('[data-testid="open-page-link"]');
			await expect(openPageLink).toBeVisible({ timeout: 10000 });

			// Page should remain stable
			const errors: string[] = [];
			page.on('pageerror', (err) => errors.push(err.message));

			await new Promise<void>((resolve) => setTimeout(resolve, 3000)); // negative proof: page remains stable (no crash)
			await expect(heading).toBeVisible();
			expect(errors).toEqual([]);
		});

		test('view page renders via SPA navigation from list', async ({ authenticatedPage: page }) => {
			// Navigate via sidebar to ensure Angular is bootstrapped before table renders.
			await page.goto('/admin');
			await page.waitForLoadState('domcontentloaded');

			await page.getByLabel('Main navigation').getByRole('link', { name: 'Pages' }).click();
			await expect(page).toHaveURL(/\/admin\/collections\/pages$/, { timeout: 10000 });

			// Wait for the first data cell to have content, then click the row to navigate
			const firstRow = page.locator('mcms-table-body mcms-table-row').first();
			const firstDataCell = firstRow.locator('mcms-table-cell').nth(1);
			await expect(firstDataCell).toContainText(/.+/, { timeout: 15000 });

			// Use expect.poll to retry the click — Angular event bindings may not be
			// attached yet even though the DOM is rendered (hydration race).
			await expect
				.poll(
					async () => {
						const currentUrl = page.url();
						if (/\/admin\/collections\/pages\/[a-f0-9-]+$/.test(currentUrl)) {
							return currentUrl;
						}
						await firstDataCell.click({ timeout: 2000 }).catch((_e: unknown) => undefined);
						// Give Angular router a moment to navigate
						await page.waitForTimeout(300);
						return page.url();
					},
					{ timeout: 15000, intervals: [500, 1000, 1500, 2000] },
				)
				.toMatch(/\/admin\/collections\/pages\/[a-f0-9-]+$/);

			const heading = page.locator('main h1').first();
			await expect(heading).toBeVisible({ timeout: 15000 });
			await expect(heading).not.toHaveText('Momentum CMS');

			// Page should remain stable
			const errors: string[] = [];
			page.on('pageerror', (err) => errors.push(err.message));

			await new Promise<void>((resolve) => setTimeout(resolve, 3000)); // negative proof: page remains stable (no crash)
			await expect(heading).toBeVisible();
			expect(errors).toEqual([]);
		});
	});
});

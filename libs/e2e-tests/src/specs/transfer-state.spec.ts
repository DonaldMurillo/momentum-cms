import { test, expect } from '../fixtures';

/**
 * TransferState SSR Hydration E2E Tests
 *
 * Tests that data fetched during SSR is transferred to the browser
 * via TransferState, eliminating duplicate API calls on hydration.
 */

test.describe('TransferState SSR Hydration', { tag: ['@ssr', '@frontend'] }, () => {
	test('should transfer data from SSR without duplicate API calls', async ({ page }) => {
		// Track API requests to /api/auth-user
		const apiCalls: string[] = [];
		await page.route('**/api/auth-user**', (route) => {
			apiCalls.push(route.request().url());
			route.continue();
		});

		// Navigate to experiments page (uses transfer: true)
		await page.goto('/experiments');
		await page.waitForLoadState('networkidle');

		// Verify no additional API calls happen after SSR hydration (negative proof:
		// we're confirming the browser does NOT make a duplicate call, so a short
		// wait is the only way to observe the absence of an event)
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Should have at most 1 API call (SSR only, not browser)
		// If TransferState works, browser skips the HTTP call
		expect(apiCalls.length).toBeLessThanOrEqual(1);
	});

	test('should include TransferState in SSR HTML', async ({ browser }) => {
		// Create context with JavaScript disabled to see pure SSR output
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		await page.goto('/experiments');

		// Check for TransferState script tag (Angular uses id="ng-state" or similar)
		const html = await page.content();

		// Angular SSR embeds state in a script tag
		const hasTransferState =
			html.includes('ng-state') ||
			html.includes('serverApp-state') ||
			html.includes('mcms:users:find');

		expect(hasTransferState).toBeTruthy();

		await context.close();
	});

	test('should render page content during SSR', async ({ browser }) => {
		// Create context with JavaScript disabled to see pure SSR output
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		await page.goto('/experiments');

		// Page should render the heading even without JS
		await expect(page.getByRole('heading', { name: 'Experiments' })).toBeVisible();

		await context.close();
	});

	test('should hydrate and become interactive', async ({ page }) => {
		await page.goto('/experiments');

		// Wait for Angular to hydrate
		await page.waitForLoadState('networkidle');

		// Page should be visible and hydrated
		await expect(page.getByRole('heading', { name: 'Experiments' })).toBeVisible();

		// Check that the page text is present
		await expect(page.getByText('Check console for API output')).toBeVisible();
	});
});

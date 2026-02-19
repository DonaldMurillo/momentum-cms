import { test, expect } from '../fixtures';

/**
 * Basic App Routing E2E Tests
 *
 * Tests basic navigation and auth redirects.
 */

test.describe('App Routing', { tag: ['@smoke'] }, () => {
	test('should load the landing page at root', async ({ page }) => {
		await page.goto('/');

		// Should load the landing page
		await expect(page).toHaveURL('/');
	});

	test('should have correct page title', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveTitle(/cms-admin|Momentum/i);
	});

	test('should redirect admin to appropriate page based on auth state', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForLoadState('networkidle');

		// Based on auth state, should be on one of these pages:
		// - /admin/setup (no users exist)
		// - /admin/login (users exist but not authenticated)
		// - /admin (authenticated - shows dashboard)
		const url = page.url();
		const isOnValidPage =
			url.includes('/admin/setup') || url.includes('/admin/login') || url.match(/\/admin\/?$/);

		expect(isOnValidPage).toBeTruthy();
	});

	test('should display appropriate content based on auth state', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForLoadState('networkidle');

		const url = page.url();

		if (url.includes('/setup')) {
			// On setup page
			await expect(
				page.getByRole('heading', { name: /welcome.*momentum|create.*admin|setup/i }),
			).toBeVisible();
		} else if (url.includes('/login')) {
			// On login page
			await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
		} else {
			// On dashboard (authenticated)
			const heading = page.getByRole('heading', { name: 'Dashboard' });
			await expect(heading).toBeVisible();
		}
	});
});

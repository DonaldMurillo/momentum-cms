import { test, expect } from '@playwright/test';

test.describe('App Routing', () => {
	test('should load the landing page at root', async ({ page }) => {
		await page.goto('/');

		// Should load the landing page
		await expect(page).toHaveURL('/');
	});

	test('should have correct page title', async ({ page }) => {
		await page.goto('/admin');

		await expect(page).toHaveTitle(/cms-admin|Momentum/i);
	});

	test('should display admin dashboard at /admin', async ({ page }) => {
		await page.goto('/admin');

		// Should see dashboard heading
		const heading = page.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});
});

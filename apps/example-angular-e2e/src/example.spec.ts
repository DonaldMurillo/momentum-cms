import { test, expect } from '@playwright/test';

test.describe('App Routing', () => {
	test('should redirect root to admin dashboard', async ({ page }) => {
		await page.goto('/');

		// Should redirect to /admin
		await expect(page).toHaveURL(/\/admin$/);
	});

	test('should have correct page title', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveTitle(/cms-admin/i);
	});

	test('should display admin dashboard after redirect', async ({ page }) => {
		await page.goto('/');

		// After redirect, should see dashboard heading
		const heading = page.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});
});

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
	test('should display Analog welcome heading', async ({ page }) => {
		await page.goto('/');

		// Use Playwright's recommended locator-based assertions
		const heading = page.getByRole('heading', { level: 1 });
		await expect(heading).toBeVisible();
		await expect(heading).toContainText('Analog');
	});

	test('should have interactive counter', async ({ page }) => {
		await page.goto('/');

		// Find the counter button and click it
		const counterButton = page.getByRole('button', { name: /count/i });
		await expect(counterButton).toBeVisible();

		// Verify initial count
		await expect(counterButton).toContainText('Count: 0');

		// Click and verify increment
		await counterButton.click();
		await expect(counterButton).toContainText('Count: 1');
	});
});

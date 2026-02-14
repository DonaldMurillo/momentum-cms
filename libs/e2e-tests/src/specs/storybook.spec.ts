import { test, expect } from '../fixtures';

/**
 * Storybook Integration E2E Tests
 *
 * Verifies that Storybook is served correctly at /storybook route.
 * These tests ensure the Express static file serving integration works.
 */

test.describe('Storybook Integration', () => {
	test('should serve Storybook at /storybook route', async ({ page }) => {
		// Navigate to the integrated Storybook route
		await page.goto('/storybook/');

		// Wait for Storybook to fully load - look for the heading
		await expect(page.getByRole('heading', { name: 'Storybook' })).toBeVisible({ timeout: 60000 });

		// Verify component listings are visible in sidebar
		await expect(page.getByText('Button')).toBeVisible({ timeout: 30000 });
	});

	test('should render component story in iframe', async ({ page }) => {
		// Navigate directly to a Button story via the integrated route
		await page.goto('/storybook/?path=/story/components-button--primary');

		// Wait for story to be selected in sidebar
		await expect(page.getByRole('link', { name: 'Primary' })).toBeVisible({ timeout: 60000 });

		// Verify the iframe renders the actual component
		const iframe = page.frameLocator('#storybook-preview-iframe');
		await expect(iframe.locator('button[mcms-button]').first()).toBeAttached({ timeout: 30000 });
	});

	test('should be reachable via direct navigation', async ({ page }) => {
		// Navigate directly to Storybook
		await page.goto('/storybook/');

		// Verify Storybook loads
		await expect(page.getByRole('heading', { name: 'Storybook' })).toBeVisible({ timeout: 60000 });

		// Verify sidebar is populated
		await expect(page.getByText('Button')).toBeVisible({ timeout: 30000 });
	});
});

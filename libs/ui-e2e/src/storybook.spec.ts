import { test, expect } from '@playwright/test';

test.describe('Storybook', () => {
	test('should load the Storybook homepage and show sidebar', async ({ page }) => {
		await page.goto('/');

		// Wait for page to load by looking for the Storybook heading
		await expect(page.getByRole('heading', { name: 'Storybook' })).toBeVisible({ timeout: 60000 });

		// Check that we can see component listings
		await expect(page.getByText('Badge')).toBeVisible();
	});

	test('should show core components in sidebar', async ({ page }) => {
		// Navigate directly to a story to ensure sidebar is loaded
		await page.goto('/?path=/story/components-button--primary');

		// Wait for story to load - this ensures the sidebar is visible
		await expect(page.getByRole('link', { name: 'Primary' })).toBeVisible({ timeout: 60000 });

		// Now check for our components - they should all be visible in the sidebar
		await expect(page.getByText('Badge')).toBeVisible();
		await expect(page.getByText('Button')).toBeVisible();
		await expect(page.getByText('Progress')).toBeVisible();
		await expect(page.getByText('Separator')).toBeVisible();
		await expect(page.getByText('Skeleton')).toBeVisible();
		await expect(page.getByText('Spinner')).toBeVisible();
	});

	test('should navigate to All Variants story and render buttons', async ({ page }) => {
		await page.goto('/?path=/story/components-button--all-variants');

		// Wait for story to be selected in sidebar
		await expect(page.getByRole('link', { name: 'All Variants' })).toBeVisible({ timeout: 30000 });

		// Wait for iframe to exist and be attached
		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Wait for story content using attached() instead of visible()
		// This works better for iframes where visibility detection can be tricky
		await expect(iframe.locator('button[mcms-button]').first()).toBeAttached({ timeout: 30000 });

		// Verify multiple buttons exist (one for each variant)
		const buttons = iframe.locator('button[mcms-button]');
		const count = await buttons.count();
		expect(count).toBeGreaterThanOrEqual(6); // Primary, Secondary, Destructive, Outline, Ghost, Link
	});

	test('should render Spinner component with SVG', async ({ page }) => {
		await page.goto('/?path=/story/components-spinner--default');

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Spinner uses SVG element - check it's attached
		await expect(iframe.locator('mcms-spinner svg').first()).toBeAttached({ timeout: 30000 });
	});

	test('should render Progress component with progressbar role', async ({ page }) => {
		await page.goto('/?path=/story/components-progress--default');

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Progress has progressbar role
		await expect(iframe.locator('[role="progressbar"]').first()).toBeAttached({ timeout: 30000 });
	});

	test('should render Skeleton component', async ({ page }) => {
		await page.goto('/?path=/story/components-skeleton--default');

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Skeleton is mcms-skeleton component
		await expect(iframe.locator('mcms-skeleton').first()).toBeAttached({ timeout: 30000 });
	});

	test('should render Separator component', async ({ page }) => {
		await page.goto('/?path=/story/components-separator--horizontal');

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Separator component
		await expect(iframe.locator('mcms-separator').first()).toBeAttached({ timeout: 30000 });
	});

	test('should render Badge component', async ({ page }) => {
		await page.goto('/?path=/story/components-badge--default');

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Badge uses mcms-badge element
		await expect(iframe.locator('mcms-badge').first()).toBeAttached({ timeout: 30000 });
	});

	test('should display Button docs page', async ({ page }) => {
		await page.goto('/?path=/docs/components-button--docs');

		// Wait for docs link to be selected
		await expect(page.getByRole('link', { name: 'Docs' }).first()).toBeVisible({ timeout: 30000 });

		const iframe = page.frameLocator('#storybook-preview-iframe');

		// Docs page should have some content - look for docs-specific elements
		await expect(iframe.locator('.sbdocs, .docs-story, h1').first()).toBeAttached({
			timeout: 30000,
		});
	});

	test('Controls panel should be visible for Button Primary story', async ({ page }) => {
		await page.goto('/?path=/story/components-button--primary');

		// Wait for story to load
		await expect(page.getByRole('link', { name: 'Primary' })).toBeVisible({ timeout: 30000 });

		// Controls panel should show our argTypes
		// Look for the Controls tab or the control labels
		await expect(page.getByText('variant')).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('size')).toBeVisible({ timeout: 15000 });
	});
});

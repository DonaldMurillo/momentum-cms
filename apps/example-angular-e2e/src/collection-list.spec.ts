import { test, expect } from '@playwright/test';

test.describe('Collection List Page - Posts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/posts');
	});

	test('should display collection heading', async ({ page }) => {
		const heading = page.getByRole('heading', { name: 'Posts' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ page }) => {
		const subtitle = page.getByText(/Manage your posts/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ page }) => {
		const createButton = page.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ page }) => {
		const createButton = page.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts\/create/);
	});

	test('should display table with column headers', async ({ page }) => {
		// Check for table headers
		await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
		await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
	});
});

test.describe('Collection List Page - Users', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/users');
	});

	test('should display collection heading', async ({ page }) => {
		const heading = page.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ page }) => {
		const subtitle = page.getByText(/Manage your users/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ page }) => {
		const createButton = page.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ page }) => {
		const createButton = page.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users\/create/);
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ page }) => {
		await page.goto('/admin/collections/posts');

		// Sidebar should show branding
		const brandingTitle = page.getByText('Momentum CMS');
		await expect(brandingTitle).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({ page }) => {
		await page.goto('/admin/collections/posts');

		const nav = page.getByRole('navigation');

		// Navigate to Users via sidebar
		await nav.getByRole('link', { name: 'Users' }).click();

		await expect(page).toHaveURL(/\/admin\/collections\/users/);
		await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate back to Posts via sidebar
		await nav.getByRole('link', { name: 'Posts' }).click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts/);
		await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});
});

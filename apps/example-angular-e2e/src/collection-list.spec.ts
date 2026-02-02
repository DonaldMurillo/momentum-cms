import { test, expect } from '@playwright/test';

test.describe('Collection List Page - Posts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/posts');
	});

	test('should display collection heading', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const heading = mainContent.getByRole('heading', { name: 'Posts' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const subtitle = mainContent.getByText(/Manage your posts/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const createButton = mainContent.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const createButton = mainContent.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts\/create/);
	});

	test('should display empty state when no documents', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		// Since there's no backend yet, we should see empty state
		const emptyState = mainContent.getByText(/No posts yet/i);
		await expect(emptyState).toBeVisible();
	});

	test('should have link to create first document in empty state', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const createFirstLink = mainContent.getByRole('link', { name: /Create your first one/i });
		await expect(createFirstLink).toBeVisible();
	});
});

test.describe('Collection List Page - Users', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/users');
	});

	test('should display collection heading', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const heading = mainContent.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const subtitle = mainContent.getByText(/Manage your users/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const createButton = mainContent.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const createButton = mainContent.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users\/create/);
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ page }) => {
		await page.goto('/admin/collections/posts');

		const sidebar = page.locator('.mcms-sidebar');
		await expect(sidebar).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({ page }) => {
		await page.goto('/admin/collections/posts');

		const navSection = page.locator('.mcms-nav-section');
		const mainContent = page.locator('.mcms-main');

		// Navigate to Users via sidebar
		await navSection.locator('.mcms-nav-item').filter({ hasText: 'Users' }).click();

		await expect(page).toHaveURL(/\/admin\/collections\/users/);
		await expect(mainContent.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate back to Posts via sidebar
		await navSection.locator('.mcms-nav-item').filter({ hasText: 'Posts' }).click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts/);
		await expect(mainContent.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});
});

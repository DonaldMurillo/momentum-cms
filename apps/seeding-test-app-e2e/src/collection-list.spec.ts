import { test, expect } from './fixtures';

/**
 * Collection List E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The seeding-test-app has: Categories, Articles, and other collections.
 * Auth collections (Users as auth-user) are injected by the auth plugin.
 */

test.describe('Collection List Page - Articles', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'Articles' });
		await expect(heading).toBeVisible();
	});

	test('should display count subtitle after data loads', async ({ authenticatedPage }) => {
		// Use client-side navigation to avoid SSR hydration timing issues with signals.
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Articles' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, {
			timeout: 10000,
		});

		// Wait for table data to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// The subtitle shows "N Articles" where N is the count
		const subtitle = authenticatedPage.getByText(/\d+ Articles/i);
		await expect(subtitle).toBeVisible({ timeout: 15000 });
	});

	test('should have Create Article button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Article/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create Article', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Article/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles\/new/);
	});

	test('should display seeded articles in table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for table to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible();

		// Check that table headers are present
		// richText fields are excluded from list view, so columns are: Title, Category, Created
		await expect(
			authenticatedPage.locator('mcms-table-head').filter({ hasText: 'Title' }).first(),
		).toBeVisible();
		await expect(
			authenticatedPage.locator('mcms-table-head').filter({ hasText: 'Category' }).first(),
		).toBeVisible();
		await expect(
			authenticatedPage.locator('mcms-table-head').filter({ hasText: 'Created' }).first(),
		).toBeVisible();

		// Seeded articles should be visible (check for ones that appear on page 1)
		// From seeding: First Tech Article, Second Tech Article, Breaking News
		await expect(
			authenticatedPage
				.locator('mcms-table-cell')
				.filter({ hasText: /First Tech Article/i })
				.first(),
		).toBeVisible();
	});
});

test.describe('Collection List Page - Categories', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'Categories' });
		await expect(heading).toBeVisible();
	});

	test('should display seeded categories in table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for table to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible();

		// Seeded categories: Technology, News, Sports
		// Use .first() since Name and Slug columns both contain similar text
		await expect(
			authenticatedPage
				.locator('mcms-table-cell')
				.filter({ hasText: /Technology/i })
				.first(),
		).toBeVisible();
		await expect(
			authenticatedPage.locator('mcms-table-cell').filter({ hasText: /News/i }).first(),
		).toBeVisible();
		await expect(
			authenticatedPage
				.locator('mcms-table-cell')
				.filter({ hasText: /Sports/i })
				.first(),
		).toBeVisible();
	});
});

test.describe('Collection List Page - Users (auth-user)', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display count subtitle after data loads', async ({ authenticatedPage }) => {
		// Use client-side navigation to avoid SSR hydration timing issues with signals.
		// Navigate to dashboard first, then click Users in sidebar.
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Users' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});

		// Wait for table data to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// The subtitle shows "N Users" where N is the count
		const subtitle = authenticatedPage.getByText(/\d+ Users?/i);
		await expect(subtitle).toBeVisible({ timeout: 15000 });
	});

	test('should NOT have Create User button (managed collection)', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// auth-user is a managed collection (read-only via API, owned by Better Auth)
		// The Create button should not be visible
		const createButton = authenticatedPage.getByRole('button', { name: /Create User/i });
		await expect(createButton).not.toBeVisible();
	});

	test('should display admin email in table data', async ({ authenticatedPage }) => {
		// Navigate via sidebar to auth-user
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Users' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});

		// Wait for table to load with actual data
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Verify the admin user email appears in a table cell
		const adminEmailCell = authenticatedPage
			.locator('mcms-table-cell')
			.filter({ hasText: 'admin@test.com' });
		await expect(adminEmailCell.first()).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Collection List Page - Auth API Keys', () => {
	test('should navigate via sidebar and display heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const nav = authenticatedPage.getByLabel('Main navigation');
		await nav.getByRole('link', { name: 'Auth Api Keys' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-api-keys/, {
			timeout: 10000,
		});

		const heading = authenticatedPage.getByRole('heading', { name: 'Auth Api Keys' });
		await expect(heading).toBeVisible();
	});

	test('should NOT show Create button for managed collection', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-api-keys');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// auth-api-keys is a managed collection — no create button
		const createButton = authenticatedPage.getByRole('button', { name: /Create/i });
		await expect(createButton).toHaveCount(0);
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Sidebar should show branding (use first() since there are multiple matching elements)
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Seeding Test App' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({
		authenticatedPage,
	}) => {
		// Use client-side navigation to avoid SSR hydration timing issues with routerLink.
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const nav = authenticatedPage.getByLabel('Main navigation');

		// Navigate to Articles via sidebar (client-side navigation)
		await nav.getByRole('link', { name: 'Articles' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, { timeout: 10000 });
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();

		// Navigate to Users via sidebar (now auth-user from auth plugin)
		await nav.getByRole('link', { name: 'Users' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate to Categories via sidebar
		await nav.getByRole('link', { name: 'Categories' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});
		await expect(authenticatedPage.getByRole('heading', { name: 'Categories' })).toBeVisible();

		// Navigate back to Articles via sidebar
		await nav.getByRole('link', { name: 'Articles' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, { timeout: 10000 });
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
	});
});

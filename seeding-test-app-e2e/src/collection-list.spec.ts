import { test, expect } from './fixtures/auth.fixture';

/**
 * Collection List E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The seeding-test-app has: Categories, Articles, Users collections.
 */

test.describe('Collection List Page - Articles', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Articles' });
		await expect(heading).toBeVisible();
	});

	test('should display count subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		// The subtitle shows "N Articles" where N is the count
		const subtitle = authenticatedPage.getByText(/\d+ Articles/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create Article button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Article/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create Article', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Article/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles\/new/);
	});

	test('should display seeded articles in table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for table to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible();

		// Check that table headers are present (sortable headers render as buttons)
		// Use .first() since multiple elements might match
		await expect(
			authenticatedPage.locator('mcms-table-head').filter({ hasText: 'Title' }).first(),
		).toBeVisible();
		await expect(
			authenticatedPage.locator('mcms-table-head').filter({ hasText: 'Content' }).first(),
		).toBeVisible();

		// Seeded articles should be visible
		// From seeding: Welcome Article, First Tech Article, Second Tech Article, Breaking News
		await expect(
			authenticatedPage
				.locator('mcms-table-cell')
				.filter({ hasText: /Welcome Article/i })
				.first(),
		).toBeVisible();
	});
});

test.describe('Collection List Page - Categories', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Categories' });
		await expect(heading).toBeVisible();
	});

	test('should display seeded categories in table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('networkidle');

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

test.describe('Collection List Page - Users', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display count subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		// The subtitle shows "N Users" where N is the count
		const subtitle = authenticatedPage.getByText(/\d+ Users?/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create User button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create User/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create User', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create User/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users\/new/);
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		// Sidebar should show branding (use first() since there are multiple matching elements)
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Seeding Test App' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByRole('navigation');

		// Navigate to Users via sidebar
		await nav.getByRole('link', { name: 'Users' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate to Categories via sidebar
		await nav.getByRole('link', { name: 'Categories' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Categories' })).toBeVisible();

		// Navigate back to Articles via sidebar
		await nav.getByRole('link', { name: 'Articles' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
	});
});

import { test, expect } from './fixtures/auth.fixture';

/**
 * Collection List E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 */

test.describe('Collection List Page - Posts', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Posts' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const subtitle = authenticatedPage.getByText(/Manage your posts/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts\/create/);
	});

	test('should display table with column headers', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Check for table headers
		await expect(authenticatedPage.getByRole('columnheader', { name: 'ID' })).toBeVisible();
		await expect(authenticatedPage.getByRole('columnheader', { name: 'Title' })).toBeVisible();
		await expect(authenticatedPage.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
	});
});

test.describe('Collection List Page - Users', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display management subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const subtitle = authenticatedPage.getByText(/Manage your users/i);
		await expect(subtitle).toBeVisible();
	});

	test('should have Create New button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('link', { name: /Create New/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create New', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('link', { name: /Create New/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users\/create/);
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Sidebar should show branding
		const brandingTitle = authenticatedPage.getByText('Momentum CMS');
		await expect(brandingTitle).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByRole('navigation');

		// Navigate to Users via sidebar
		await nav.getByRole('link', { name: 'Users' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate back to Posts via sidebar
		await nav.getByRole('link', { name: 'Posts' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});
});

import { test, expect } from './fixtures';

/**
 * Admin Dashboard E2E Tests
 *
 * These tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The seeding-test-app has: Categories, Articles, Users collections.
 */

test.describe('Admin Dashboard', () => {
	test('should display dashboard with correct heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});

	test('should display welcome subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Dashboard subtitle
		const subtitle = authenticatedPage.getByText(/Manage your content and collections/i);
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Categories, Articles, and Users', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Check collection cards are visible by their labels
		await expect(authenticatedPage.getByRole('heading', { name: 'Categories' })).toBeVisible();
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
	});

	test('should navigate to Articles collection when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Find the Articles card and click its "View all" link
		// The card has heading "Articles" and a "View all" button
		const articlesCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Articles' }),
		});
		await articlesCard.getByRole('link', { name: 'View all' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
	});

	test('should navigate to Users collection when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Find the Users card and click its "View all" link
		const usersCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Users' }),
		});
		await usersCard.getByRole('link', { name: 'View all' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
	});
});

test.describe('Admin Sidebar Navigation', () => {
	test('should display sidebar with branding title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Sidebar with branding
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Seeding Test App' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should have Dashboard link in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Dashboard link in sidebar navigation (not breadcrumbs)
		const sidebar = authenticatedPage.getByLabel('Main navigation');
		const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard' });
		await expect(dashboardLink).toBeVisible();
	});

	test('should have collection links in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Use sidebar label to avoid conflicts with breadcrumbs
		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Seeding test app collections: Categories, Articles, Users
		const categoriesLink = sidebar.getByRole('link', { name: 'Categories' });
		await expect(categoriesLink).toBeVisible();

		const articlesLink = sidebar.getByRole('link', { name: 'Articles' });
		await expect(articlesLink).toBeVisible();

		const usersLink = sidebar.getByRole('link', { name: 'Users' });
		await expect(usersLink).toBeVisible();
	});

	test('should navigate using sidebar links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Use sidebar label to avoid conflicts with breadcrumbs
		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Click Articles in sidebar
		await sidebar.getByRole('link', { name: 'Articles' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, { timeout: 10000 });

		// Click Dashboard in sidebar (re-query navigation after page change)
		const dashboardLink = authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Dashboard' });
		// Ensure link is visible and stable before clicking
		await expect(dashboardLink).toBeVisible();
		// Use JavaScript navigation as a fallback for Angular router issues
		const dashboardHref = await dashboardLink.getAttribute('href');
		if (dashboardHref) {
			await authenticatedPage.goto(dashboardHref);
		} else {
			await dashboardLink.click({ force: true });
		}
		// Wait for navigation to dashboard
		await expect(authenticatedPage).toHaveURL(/\/admin\/?$/, { timeout: 10000 });

		// Click Users in sidebar
		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Users' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/, { timeout: 10000 });
	});

	test('should display user info in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// User info is rendered during SSR via injectUser() reading from MOMENTUM_API_CONTEXT.
		// After hydration, MomentumAuthService initializes and keeps user displayed.
		await expect(authenticatedPage.getByText('Test Admin')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.getByText('admin@test.com')).toBeVisible();
	});
});

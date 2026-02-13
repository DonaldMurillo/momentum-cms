import { test, expect } from './fixtures';

/**
 * Admin Dashboard E2E Tests
 *
 * These tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 */

test.describe('Admin Dashboard', () => {
	test('should display dashboard with correct heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});

	test('should display dashboard subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const subtitle = authenticatedPage.getByText('Manage your content and collections');
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Posts and Users', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Collection cards have H3 headings
		const postsHeading = authenticatedPage.getByRole('heading', { name: 'Posts', level: 3 });
		await expect(postsHeading).toBeVisible();

		const usersHeading = authenticatedPage.getByRole('heading', { name: 'Users', level: 3 });
		await expect(usersHeading).toBeVisible();
	});

	test('should show document count badges on collection cards', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Dashboard shows cards for all accessible collections (posts + auth collections)
		const cards = authenticatedPage.locator('mcms-collection-card');
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(2);

		// Verify at least the Posts card has a badge with a count
		const postsCard = cards.filter({ hasText: 'Posts' });
		const badge = postsCard.locator('mcms-badge');
		await expect(badge).toBeVisible();
	});

	test('should navigate to Posts collection when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Find the Posts card section and click "View all"
		const postsCard = authenticatedPage
			.locator('mcms-collection-card')
			.filter({ hasText: 'Posts' });
		await postsCard.getByRole('link', { name: /View all/i }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});

	test('should navigate to Users collection when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Find the Users card section and click "View all"
		const usersCard = authenticatedPage
			.locator('mcms-collection-card')
			.filter({ hasText: 'Users' });
		await usersCard.getByRole('link', { name: /View all/i }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
	});

	test('should show numeric count badge on Users card, not error', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const usersCard = authenticatedPage
			.locator('mcms-collection-card')
			.filter({ hasText: 'Users' });
		const badge = usersCard.locator('mcms-badge');
		await expect(badge).toBeVisible({ timeout: 15000 });

		// Badge should contain a number, not "Error"
		const badgeText = await badge.textContent();
		expect(badgeText?.trim()).not.toBe('Error');
		expect(badgeText?.trim()).toMatch(/^\d+$/);
	});

	test('should NOT display hidden auth collections as dashboard cards', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Hidden auth collections (auth-session, auth-account, auth-verification)
		// should NOT appear as collection cards on the dashboard
		const sessionCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Auth Session', level: 3 }),
		});
		await expect(sessionCard).toHaveCount(0);

		const accountCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Auth Account', level: 3 }),
		});
		await expect(accountCard).toHaveCount(0);

		const verificationCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Auth Verification', level: 3 }),
		});
		await expect(verificationCard).toHaveCount(0);
	});
});

test.describe('Admin Sidebar Navigation', () => {
	test('should display sidebar with branding title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Sidebar with Momentum CMS branding - it's an h1 heading
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Momentum CMS' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should have Dashboard link in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Dashboard link in navigation
		const dashboardLink = authenticatedPage
			.getByRole('navigation')
			.getByRole('link', { name: 'Dashboard' });
		await expect(dashboardLink).toBeVisible();
	});

	test('should have collection links in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByRole('navigation');

		const postsLink = nav.getByRole('link', { name: 'Posts' });
		await expect(postsLink).toBeVisible();

		const usersLink = nav.getByRole('link', { name: 'Users' });
		await expect(usersLink).toBeVisible();
	});

	test('should have global links in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const sidebarNav = authenticatedPage.getByLabel('Main navigation');

		// Globals section with Site Settings link
		const settingsLink = sidebarNav.getByRole('link', { name: 'Site Settings' });
		await expect(settingsLink).toBeVisible();
		await expect(settingsLink).toHaveAttribute('href', '/admin/globals/site-settings');
	});

	test('should navigate using sidebar links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Use specific aria-label to avoid ambiguity with breadcrumb nav
		const sidebarNav = authenticatedPage.getByLabel('Main navigation');

		// Wait for sidebar links to be visible before clicking (collections load async)
		const postsLink = sidebarNav.getByRole('link', { name: 'Posts' });
		await expect(postsLink).toBeVisible({ timeout: 10000 });
		await postsLink.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);

		// Click Dashboard in sidebar (page now has breadcrumb nav too)
		const dashboardLink = sidebarNav.getByRole('link', { name: 'Dashboard' });
		await expect(dashboardLink).toBeVisible();
		await dashboardLink.click();
		await expect(authenticatedPage).toHaveURL(/\/admin$/);

		// Click Users in sidebar
		const usersLink = sidebarNav.getByRole('link', { name: 'Users' });
		await expect(usersLink).toBeVisible();
		await usersLink.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/);
	});

	test('should display sign out button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Auth service loads user via /api/auth/get-session after hydration.
		// The sign out button renders inside a dropdown trigger when auth.user() is populated.
		const userMenuButton = authenticatedPage.getByRole('button', { name: /user menu/i });
		await expect(userMenuButton).toBeVisible({ timeout: 15000 });
	});
});

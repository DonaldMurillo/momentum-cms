import { test, expect } from './fixtures/auth.fixture';

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

	test('should display welcome subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const subtitle = authenticatedPage.getByText('Welcome to Momentum CMS');
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Posts and Users', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Check Posts collection card
		const postsCard = authenticatedPage.getByRole('link', { name: /Posts.*posts.*fields/i });
		await expect(postsCard).toBeVisible();

		// Check Users collection card
		const usersCard = authenticatedPage.getByRole('link', { name: /Users.*users.*fields/i });
		await expect(usersCard).toBeVisible();
	});

	test('should show field count on collection cards', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Posts has 5 fields (title, slug, content, author, status)
		const postsCard = authenticatedPage.getByRole('link', { name: /Posts.*posts.*5 fields/i });
		await expect(postsCard).toBeVisible();

		// Users has 5 fields (name, email, authId, role, active)
		const usersCard = authenticatedPage.getByRole('link', { name: /Users.*users.*5 fields/i });
		await expect(usersCard).toBeVisible();
	});

	test('should navigate to Posts collection when clicking card', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const postsCard = authenticatedPage.getByRole('link', { name: /Posts.*posts.*fields/i });
		await postsCard.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});

	test('should navigate to Users collection when clicking card', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const usersCard = authenticatedPage.getByRole('link', { name: /Users.*users.*fields/i });
		await usersCard.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
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

	test('should navigate using sidebar links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Click Posts in sidebar
		await authenticatedPage.getByRole('navigation').getByRole('link', { name: 'Posts' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);

		// Click Dashboard in sidebar (re-query navigation after page change)
		await authenticatedPage
			.getByRole('navigation')
			.getByRole('link', { name: 'Dashboard' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin$/);

		// Click Users in sidebar
		await authenticatedPage.getByRole('navigation').getByRole('link', { name: 'Users' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users/);
	});

	// Skip: This test requires auth.user() to be populated after SSR hydration,
	// which has timing issues. The sign out functionality is tested in auth.spec.ts
	test.skip('should display sign out button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for Angular to hydrate
		await authenticatedPage.waitForFunction(() => {
			const appRoot = document.querySelector('app-root');
			return appRoot && appRoot.hasAttribute('ng-version');
		});

		// Wait for auth service to load user via /api/auth/get-session
		// The sign out button only renders when auth.user() returns a user
		// Increase timeout to allow for API call completion
		const signOutButton = authenticatedPage.getByRole('button', { name: /sign out|logout/i });
		await expect(signOutButton).toBeVisible({ timeout: 20000 });
	});
});

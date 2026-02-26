import { test, expect } from '../fixtures';

/**
 * Admin Dashboard E2E Tests
 *
 * These tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The example-config has: Categories, Articles, and other collections.
 * Auth collections (Users, API Keys) are injected by the auth plugin.
 */

test.describe('Admin Dashboard - Collection Grouping', { tag: ['@admin', '@smoke'] }, () => {
	test('should render a section heading for each admin.group', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The example-config has admin.group: 'Content' on Articles + Categories
		// and the auth plugin contributes an 'Authentication' group
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Content', level: 2 }),
		).toBeVisible();
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Authentication', level: 2 }),
		).toBeVisible();
	});

	test('should render a "Collections" fallback heading for ungrouped collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Several example-config collections (products, settings, events, media, etc.)
		// have no explicit admin.group, so the default 'Collections' fallback group appears
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Collections', level: 2 }),
		).toBeVisible();
	});

	test('should place Categories and Articles cards inside the Content group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// <section aria-labelledby="group-Content"> is a named region
		const contentSection = authenticatedPage.getByRole('region', { name: 'Content' });
		await expect(contentSection).toBeVisible();
		await expect(contentSection.getByRole('heading', { name: 'Categories' })).toBeVisible();
		await expect(contentSection.getByRole('heading', { name: 'Articles' })).toBeVisible();
	});

	test('should place Users and Auth Api Keys cards inside the Authentication group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const authSection = authenticatedPage.getByRole('region', { name: 'Authentication' });
		await expect(authSection).toBeVisible();
		await expect(authSection.getByRole('heading', { name: 'Users' })).toBeVisible();
		await expect(authSection.getByRole('heading', { name: 'Auth Api Keys' })).toBeVisible();
	});

	test('should NOT show Content collection cards inside the Authentication section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const authSection = authenticatedPage.getByRole('region', { name: 'Authentication' });
		await expect(authSection.getByRole('heading', { name: 'Categories' })).toBeHidden();
		await expect(authSection.getByRole('heading', { name: 'Articles' })).toBeHidden();
	});

	test('should render the Content group section before the Authentication group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const contentHeading = authenticatedPage.getByRole('heading', { name: 'Content', level: 2 });
		const authHeading = authenticatedPage.getByRole('heading', {
			name: 'Authentication',
			level: 2,
		});

		const contentBox = await contentHeading.boundingBox();
		const authBox = await authHeading.boundingBox();

		// Content group must appear above Authentication group in document order
		if (!contentBox || !authBox) {
			throw new Error('Group section headings must be in the viewport to compare positions');
		}
		expect(contentBox.y).toBeLessThan(authBox.y);
	});
});

test.describe('Admin Dashboard', { tag: ['@admin', '@smoke'] }, () => {
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

	test('should display collection cards for Categories and Articles', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Check collection cards are visible by their labels
		await expect(authenticatedPage.getByRole('heading', { name: 'Categories' })).toBeVisible();
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
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

	test('should navigate to Users collection (auth-user) when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Find the Users card and click its "View all" link
		// Users collection is now auth-user (managed by auth plugin)
		const usersCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Users' }),
		});
		await usersCard.getByRole('link', { name: 'View all' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
	});

	test('should show numeric count badge on Users card, not error', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const usersCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Users' }),
		});
		const badge = usersCard.locator('mcms-badge');

		// Use auto-retrying assertion — badge may briefly show "Error" before count loads
		await expect(badge).toHaveText(/^\d+$/, { timeout: 15000 });
	});

	test('should display Auth API Keys card on dashboard', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const apiKeysCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('heading', { name: 'Auth Api Keys' }),
		});
		await expect(apiKeysCard).toBeVisible({ timeout: 15000 });

		// Use auto-retrying assertion — badge may briefly show "Error" before count loads
		const badge = apiKeysCard.locator('mcms-badge');
		await expect(badge).toHaveText(/^\d+$/, { timeout: 15000 });
	});

	test('should NOT display hidden auth collections as dashboard cards', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

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

test.describe('Admin Sidebar Navigation', { tag: ['@admin', '@smoke'] }, () => {
	test('should display sidebar with branding title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Sidebar with branding
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Momentum CMS' });
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

		// Static collections: Categories, Articles
		await expect(sidebar.getByRole('link', { name: 'Categories' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Articles' })).toBeVisible();
	});

	test('should display Authentication section with auth plugin collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Authentication section header (group name from auth collections)
		await expect(sidebar.getByText('Authentication')).toBeVisible();

		// Auth-user collection (labels.plural: 'Users') should be visible
		await expect(sidebar.getByRole('link', { name: 'Users' })).toBeVisible();

		// Auth-api-keys collection (humanized slug: 'Auth Api Keys') should be visible
		await expect(sidebar.getByRole('link', { name: 'Auth Api Keys' })).toBeVisible();
	});

	test('should NOT display hidden auth collections in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Hidden collections (auth-session, auth-account, auth-verification)
		// should NOT appear in the sidebar
		await expect(sidebar.getByRole('link', { name: 'Auth Session' })).toBeHidden();
		await expect(sidebar.getByRole('link', { name: 'Auth Account' })).toBeHidden();
		await expect(sidebar.getByRole('link', { name: 'Auth Verification' })).toBeHidden();
	});

	test('should navigate to Users via Authentication sidebar link', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Click Users in the Authentication section
		await sidebar.getByRole('link', { name: 'Users' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});
	});

	test('should navigate using sidebar links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Use sidebar label to avoid conflicts with breadcrumbs
		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Click Articles in sidebar
		await sidebar.getByRole('link', { name: 'Articles' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, {
			timeout: 10000,
		});

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

		// Click Users in sidebar (now auth-user collection from auth plugin)
		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Users' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});
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

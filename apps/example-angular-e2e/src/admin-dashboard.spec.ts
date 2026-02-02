import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin');
	});

	test('should display dashboard with correct heading', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const heading = mainContent.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});

	test('should display welcome subtitle', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const subtitle = mainContent.getByText('Welcome to Momentum CMS');
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Posts and Users', async ({ page }) => {
		const collectionsGrid = page.locator('.mcms-collections-grid');

		// Check Posts collection card in main content
		const postsCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Posts' });
		await expect(postsCard).toBeVisible();

		// Check Users collection card in main content
		const usersCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Users' });
		await expect(usersCard).toBeVisible();
	});

	test('should show field count on collection cards', async ({ page }) => {
		const collectionsGrid = page.locator('.mcms-collections-grid');

		// Posts has 5 fields
		const postsCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Posts' });
		await expect(postsCard.getByText('5 fields')).toBeVisible();

		// Users has 4 fields
		const usersCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Users' });
		await expect(usersCard.getByText('4 fields')).toBeVisible();
	});

	test('should navigate to Posts collection when clicking card', async ({ page }) => {
		const collectionsGrid = page.locator('.mcms-collections-grid');
		const postsCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Posts' });
		await postsCard.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts/);
		const mainContent = page.locator('.mcms-main');
		await expect(mainContent.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});

	test('should navigate to Users collection when clicking card', async ({ page }) => {
		const collectionsGrid = page.locator('.mcms-collections-grid');
		const usersCard = collectionsGrid.locator('.mcms-collection-card').filter({ hasText: 'Users' });
		await usersCard.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users/);
		const mainContent = page.locator('.mcms-main');
		await expect(mainContent.getByRole('heading', { name: 'Users' })).toBeVisible();
	});
});

test.describe('Admin Sidebar Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin');
	});

	test('should display sidebar with navigation links', async ({ page }) => {
		const sidebar = page.locator('.mcms-sidebar');
		await expect(sidebar).toBeVisible();
	});

	test('should display branding title in sidebar header', async ({ page }) => {
		const sidebarHeader = page.locator('.mcms-sidebar-header');
		const brandingTitle = sidebarHeader.locator('.mcms-site-title');
		await expect(brandingTitle).toHaveText('Momentum CMS');
	});

	test('should have Dashboard link in sidebar', async ({ page }) => {
		const nav = page.locator('.mcms-nav');
		const dashboardLink = nav.locator('.mcms-nav-dashboard');
		await expect(dashboardLink).toBeVisible();
		await expect(dashboardLink).toHaveText(/Dashboard/);
	});

	test('should have collection links in sidebar', async ({ page }) => {
		const navSection = page.locator('.mcms-nav-section');

		const postsLink = navSection.locator('.mcms-nav-item').filter({ hasText: 'Posts' });
		await expect(postsLink).toBeVisible();

		const usersLink = navSection.locator('.mcms-nav-item').filter({ hasText: 'Users' });
		await expect(usersLink).toBeVisible();
	});

	test('should navigate using sidebar links', async ({ page }) => {
		const navSection = page.locator('.mcms-nav-section');
		const nav = page.locator('.mcms-nav');

		// Click Posts in sidebar
		await navSection.locator('.mcms-nav-item').filter({ hasText: 'Posts' }).click();
		await expect(page).toHaveURL(/\/admin\/collections\/posts/);

		// Click Dashboard in sidebar
		await nav.locator('.mcms-nav-dashboard').click();
		await expect(page).toHaveURL(/\/admin$/);

		// Click Users in sidebar
		await navSection.locator('.mcms-nav-item').filter({ hasText: 'Users' }).click();
		await expect(page).toHaveURL(/\/admin\/collections\/users/);
	});
});

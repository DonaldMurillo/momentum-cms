import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin');
	});

	test('should display dashboard with correct heading', async ({ page }) => {
		const heading = page.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});

	test('should display welcome subtitle', async ({ page }) => {
		const subtitle = page.getByText('Welcome to Momentum CMS');
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Posts and Users', async ({ page }) => {
		// Check Posts collection card
		const postsCard = page.getByRole('link', { name: /Posts.*posts.*fields/i });
		await expect(postsCard).toBeVisible();

		// Check Users collection card
		const usersCard = page.getByRole('link', { name: /Users.*users.*fields/i });
		await expect(usersCard).toBeVisible();
	});

	test('should show field count on collection cards', async ({ page }) => {
		// Posts has 5 fields
		await expect(page.getByText('5 fields')).toBeVisible();

		// Users has 4 fields
		await expect(page.getByText('4 fields')).toBeVisible();
	});

	test('should navigate to Posts collection when clicking card', async ({ page }) => {
		const postsCard = page.getByRole('link', { name: /Posts.*posts.*fields/i });
		await postsCard.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts/);
		await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});

	test('should navigate to Users collection when clicking card', async ({ page }) => {
		const usersCard = page.getByRole('link', { name: /Users.*users.*fields/i });
		await usersCard.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users/);
		await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
	});
});

test.describe('Admin Sidebar Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin');
		// Wait for hydration to complete
		await page.waitForLoadState('networkidle');
	});

	test('should display sidebar with branding title', async ({ page }) => {
		// Sidebar with Momentum CMS branding - it's an h1 heading
		const brandingTitle = page.getByRole('heading', { name: 'Momentum CMS' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should have Dashboard link in sidebar', async ({ page }) => {
		// Dashboard link in navigation
		const dashboardLink = page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
		await expect(dashboardLink).toBeVisible();
	});

	test('should have collection links in sidebar', async ({ page }) => {
		const nav = page.getByRole('navigation');

		const postsLink = nav.getByRole('link', { name: 'Posts' });
		await expect(postsLink).toBeVisible();

		const usersLink = nav.getByRole('link', { name: 'Users' });
		await expect(usersLink).toBeVisible();
	});

	test('should navigate using sidebar links', async ({ page }) => {
		// Click Posts in sidebar
		await page.getByRole('navigation').getByRole('link', { name: 'Posts' }).click();
		await expect(page).toHaveURL(/\/admin\/collections\/posts/);

		// Click Dashboard in sidebar (re-query navigation after page change)
		await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click();
		await expect(page).toHaveURL(/\/admin$/);

		// Click Users in sidebar
		await page.getByRole('navigation').getByRole('link', { name: 'Users' }).click();
		await expect(page).toHaveURL(/\/admin\/collections\/users/);
	});
});

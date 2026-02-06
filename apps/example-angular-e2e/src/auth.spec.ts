import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow including:
 * - Login page display
 * - Protected route redirection
 * - Session persistence
 * - Logout functionality
 * - Authenticated user info display
 *
 * IMPORTANT: These tests run against a real server with a real database.
 * The worker fixture always creates users, so setup page tests are not
 * possible in this infrastructure (they require an empty database).
 *
 * Tests use `authenticatedPage` (pre-logged-in admin) or `page`
 * (unauthenticated) fixtures — no conditional gates.
 */

test.describe('Login Page', { tag: ['@auth'] }, () => {
	test('should display login form for unauthenticated users', async ({ page }) => {
		await page.goto('/admin/login');

		// Unauthenticated page should stay on login (users exist in worker DB)
		await expect(page).toHaveURL(/\/admin\/login/);
		await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
	});
});

test.describe('Protected Routes', { tag: ['@auth', '@access'] }, () => {
	test('should redirect authenticated user from login to dashboard', async ({
		authenticatedPage,
	}) => {
		// Authenticated user navigating to login should be redirected to admin dashboard
		await authenticatedPage.goto('/admin/login');
		await expect(authenticatedPage).toHaveURL(/\/admin(?!\/login|\/setup)/, { timeout: 10000 });
	});

	test('should redirect unauthenticated user to login', async ({ page }) => {
		// Unauthenticated page accessing admin should redirect to login
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });
	});
});

test.describe('Session Management', { tag: ['@auth', '@security'] }, () => {
	test('session should persist across page reloads', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await expect(authenticatedPage).toHaveURL(/\/admin(?!\/login|\/setup)/);

		// Reload the page — session cookies should persist
		await authenticatedPage.reload();

		// Should still be on admin dashboard, not redirected to login or setup
		await expect(authenticatedPage).toHaveURL(/\/admin(?!\/login|\/setup)/, { timeout: 10000 });
	});

	test('logout should clear session and redirect to login', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await expect(authenticatedPage).toHaveURL(/\/admin/);

		// Open user menu
		const userMenuButton = authenticatedPage.locator('button[aria-label*="User menu"]');
		await expect(userMenuButton).toBeVisible();
		await userMenuButton.click();

		// Click the sign out button in the dropdown
		const signOutButton = authenticatedPage.getByRole('menuitem', { name: /sign out/i });
		await expect(signOutButton).toBeVisible();
		await signOutButton.click();

		// Should redirect to login page
		await expect(authenticatedPage).toHaveURL(/\/admin\/login/, { timeout: 10000 });
	});
});

test.describe('Authenticated User Info', { tag: ['@auth'] }, () => {
	test('should display user name in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await expect(authenticatedPage).toHaveURL(/\/admin/);

		// The user menu button has aria-label "User menu for <name>"
		const userMenuButton = authenticatedPage.locator(
			`button[aria-label*="User menu for ${TEST_CREDENTIALS.name}"]`,
		);
		await expect(userMenuButton).toBeVisible();

		// User email should be visible in the sidebar footer
		await expect(authenticatedPage.getByText(TEST_CREDENTIALS.email)).toBeVisible();
	});
});

/* eslint-disable no-console */
import { chromium, type FullConfig, type Page } from '@playwright/test';
import * as path from 'path';

// Auth file path - matches the path used in playwright.config.ts
const AUTH_FILE = path.join(__dirname, '..', 'playwright/.auth/user.json');

/**
 * Wait for the page to settle on a final auth state.
 * With SSR, the server may return one page but client-side redirects to another.
 */
async function waitForAuthState(
	page: Page,
	timeout = 30000,
): Promise<'setup' | 'login' | 'authenticated'> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		// Wait for any pending navigations
		await page.waitForLoadState('networkidle');

		const url = page.url();

		// Check if we're on a stable auth-related page
		if (url.includes('/setup')) {
			// Verify the setup form is visible to confirm we're really on setup
			const nameField = page.getByLabel(/full name/i);
			if (await nameField.isVisible().catch(() => false)) {
				return 'setup';
			}
		} else if (url.includes('/login')) {
			// Verify the login form is visible to confirm we're really on login
			const emailField = page.getByLabel(/email/i);
			if (await emailField.isVisible().catch(() => false)) {
				return 'login';
			}
		} else if (url.includes('/admin')) {
			// Verify we're on the dashboard (not redirecting)
			const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
			if (await dashboardHeading.isVisible().catch(() => false)) {
				return 'authenticated';
			}
		}

		// Wait a bit before checking again
		await page.waitForTimeout(500);
	}

	throw new Error(`Timed out waiting for auth state. Current URL: ${page.url()}`);
}

/**
 * Global setup for E2E tests.
 *
 * Creates a test admin user if one doesn't exist, and saves the
 * authentication state for other tests to reuse.
 */
async function globalSetup(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0].use.baseURL || 'http://localhost:4200';

	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		// Navigate to admin - with SSR, the server may return admin page but client redirects
		console.log('Navigating to /admin...');
		await page.goto(`${baseURL}/admin`);

		// Wait for the auth state to stabilize after client-side hydration
		const authState = await waitForAuthState(page);
		console.log(`Auth state: ${authState}`);

		if (authState === 'setup') {
			// No users exist - create the first admin user
			console.log('Creating test admin user...');

			await page.getByLabel(/full name/i).fill('Test Admin');
			await page.getByLabel(/email address/i).fill('admin@test.com');
			await page.getByRole('textbox', { name: /^password$/i }).fill('TestPassword123!');
			await page.getByRole('textbox', { name: /confirm password/i }).fill('TestPassword123!');

			// Wait for button to be enabled
			const submitButton = page.getByRole('button', { name: /create|submit|sign up/i });
			await submitButton.click();

			// Wait for redirect to admin dashboard
			await page.waitForURL(/\/admin(?!\/setup|\/login)/, { timeout: 30000 });
			console.log('Admin user created and logged in');
		} else if (authState === 'login') {
			// Users exist but not logged in - login with test credentials
			console.log('Logging in with test admin...');

			await page.getByLabel(/email/i).fill('admin@test.com');
			await page.getByLabel(/password/i).fill('TestPassword123!');

			const submitButton = page.getByRole('button', { name: /sign in|login/i });
			await submitButton.click();

			// Wait for redirect to admin dashboard
			await page.waitForURL(/\/admin(?!\/setup|\/login)/, { timeout: 30000 });
			console.log('Logged in successfully');
		} else {
			// Already authenticated
			console.log('Already authenticated');
		}

		// Save the authentication state to the same path used by playwright.config.ts
		await context.storageState({ path: AUTH_FILE });
		console.log(`Authentication state saved to ${AUTH_FILE}`);
	} catch (error) {
		console.error('Global setup failed:', error);
		throw error;
	} finally {
		await browser.close();
	}
}

export default globalSetup;

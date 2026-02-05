import type { Page } from '@playwright/test';

/**
 * Shared E2E test utilities.
 */

/** Auth state after SSR hydration settles. */
export type AuthState = 'setup' | 'login' | 'authenticated';

/**
 * Wait for the page to settle on a final auth state.
 * With SSR, the server may return one page but client-side redirects to another.
 */
export async function waitForAuthState(page: Page, timeout = 30000): Promise<AuthState> {
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

/** Test user credentials shared across global setup and auth fixtures. */
export const TEST_CREDENTIALS = {
	name: 'Test Admin',
	email: 'admin@test.com',
	password: 'TestPassword123!',
};

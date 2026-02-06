import type { Page } from '@playwright/test';
import * as path from 'path';

/**
 * Shared E2E test utilities.
 */

// Auth file paths for storing session state per user role
const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright/.auth');

/** Get the auth state file path for a given user email. */
export function getAuthFilePath(email: string): string {
	const sanitized = email.replace(/[@.]/g, '-');
	return path.join(AUTH_DIR, `${sanitized}.json`);
}

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
			if (await nameField.isVisible()) {
				return 'setup';
			}
		} else if (url.includes('/login')) {
			// Verify the login form is visible to confirm we're really on login
			const emailField = page.getByLabel(/email/i);
			if (await emailField.isVisible()) {
				return 'login';
			}
		} else if (url.includes('/admin')) {
			// Verify we're on the dashboard (not redirecting)
			const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
			if (await dashboardHeading.isVisible()) {
				return 'authenticated';
			}
		}

		// Brief polling interval before checking again
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`Timed out waiting for auth state. Current URL: ${page.url()}`);
}

/** Credentials for a single test user. */
export interface TestUserCredentials {
	name: string;
	email: string;
	password: string;
	role: 'admin' | 'editor' | 'viewer';
}

/** Test user credentials shared across global setup and auth fixtures. */
export const TEST_CREDENTIALS: TestUserCredentials = {
	name: 'Test Admin',
	email: 'admin@test.com',
	password: 'TestPassword123!',
	role: 'admin',
};

/** Editor user for field renderer tests (array, group, blocks, etc.) */
export const TEST_EDITOR_CREDENTIALS: TestUserCredentials = {
	name: 'Test Editor',
	email: 'editor@test.com',
	password: 'EditorPass123!',
	role: 'editor',
};

/** Viewer user for read-only / access control tests */
export const TEST_VIEWER_CREDENTIALS: TestUserCredentials = {
	name: 'Test Viewer',
	email: 'viewer@test.com',
	password: 'ViewerPass123!',
	role: 'viewer',
};

/** Author users for parallel content tests */
export const TEST_AUTHOR1_CREDENTIALS: TestUserCredentials = {
	name: 'Author One',
	email: 'author1@test.com',
	password: 'Author1Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR2_CREDENTIALS: TestUserCredentials = {
	name: 'Author Two',
	email: 'author2@test.com',
	password: 'Author2Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR3_CREDENTIALS: TestUserCredentials = {
	name: 'Author Three',
	email: 'author3@test.com',
	password: 'Author3Pass123!',
	role: 'editor',
};

/** All non-admin test users that need to be created during global setup. */
export const ADDITIONAL_TEST_USERS: TestUserCredentials[] = [
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
];

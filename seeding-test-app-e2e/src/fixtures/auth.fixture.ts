import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { waitForAuthState, TEST_CREDENTIALS } from './e2e-utils';

/**
 * Authentication Test Fixture
 *
 * Provides an authenticatedPage fixture that ensures the user is logged in.
 * Loads stored auth state from global setup, and falls back to logging in
 * if the session is invalid.
 */

// Auth file path - matches the path used in global-setup.ts
const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright/.auth/user.json');

export const test = base.extend<{ authenticatedPage: Page }>({
	authenticatedPage: async ({ browser }, use) => {
		// eslint-disable-next-line no-console
		console.log('[Auth Fixture] Starting...');

		// Try to load storage state if it exists
		let storageState: string | undefined;
		if (fs.existsSync(AUTH_FILE)) {
			try {
				const content = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
				if (content.cookies && content.cookies.length > 0) {
					storageState = AUTH_FILE;
					// eslint-disable-next-line no-console
					console.log(`[Auth Fixture] Found ${content.cookies.length} cookies in storage`);
				}
			} catch {
				// Failed to read auth file
			}
		}

		// Create context with storage state if available
		const context: BrowserContext = storageState
			? await browser.newContext({ storageState })
			: await browser.newContext();

		const page = await context.newPage();

		// eslint-disable-next-line no-console
		console.log('[Auth Fixture] Navigating to /admin...');

		// Navigate to admin
		await page.goto('/admin');

		// Wait for auth state to settle after client-side hydration
		const authState = await waitForAuthState(page);
		// eslint-disable-next-line no-console
		console.log(`[Auth Fixture] Auth state: ${authState}`);

		// If on login page, the session is invalid - log in
		if (authState === 'login') {
			// eslint-disable-next-line no-console
			console.log('[Auth Fixture] On login page, logging in...');

			await page.getByLabel(/email/i).fill(TEST_CREDENTIALS.email);
			await page.getByLabel(/password/i).fill(TEST_CREDENTIALS.password);
			await page.getByRole('button', { name: /sign in|login/i }).click();

			// eslint-disable-next-line no-console
			console.log('[Auth Fixture] Submitted login form, waiting for redirect...');

			// Wait for auth state to become authenticated
			const postLoginState = await waitForAuthState(page);
			// eslint-disable-next-line no-console
			console.log(`[Auth Fixture] Post-login state: ${postLoginState}`);

			if (postLoginState !== 'authenticated') {
				throw new Error(`[Auth Fixture] Login failed. State: ${postLoginState}`);
			}

			// Save the new session cookies to the auth file for reuse
			await context.storageState({ path: AUTH_FILE });
			// eslint-disable-next-line no-console
			console.log('[Auth Fixture] Saved new session to storage file');
		} else if (authState === 'setup') {
			// No users exist - this shouldn't happen if global setup ran
			throw new Error(
				'[Auth Fixture] Unexpected: no users exist. Run tests with global setup enabled.',
			);
		} else {
			// eslint-disable-next-line no-console
			console.log('[Auth Fixture] Already authenticated');
		}

		// eslint-disable-next-line no-console
		console.log('[Auth Fixture] Passing authenticated page to test');

		await use(page);

		// Clean up
		await context.close();
	},
});

export { expect };
export { TEST_CREDENTIALS };

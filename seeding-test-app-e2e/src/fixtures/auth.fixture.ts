import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import {
	waitForAuthState,
	getAuthFilePath,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
	type TestUserCredentials,
} from './e2e-utils';

/**
 * Authentication Test Fixtures
 *
 * Provides per-role fixtures that ensure the correct user is logged in.
 * Loads stored auth state from global setup, and falls back to logging in
 * if the session is invalid.
 */

/**
 * Create an authenticated page fixture for a given set of credentials.
 * Loads stored auth state if available, falls back to API sign-in.
 */
function createAuthPageFixture(
	credentials: TestUserCredentials,
): (
	args: { browser: import('@playwright/test').Browser },
	use: (page: Page) => Promise<void>,
) => Promise<void> {
	return async ({ browser }, use) => {
		const label = `[Auth:${credentials.role}]`;
		// eslint-disable-next-line no-console
		console.log(`${label} Starting fixture for ${credentials.email}...`);

		const authFile = getAuthFilePath(credentials.email);

		// Try to load storage state if it exists
		let storageState: string | undefined;
		if (fs.existsSync(authFile)) {
			try {
				const content = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
				if (content.cookies && content.cookies.length > 0) {
					storageState = authFile;
					// eslint-disable-next-line no-console
					console.log(`${label} Found ${content.cookies.length} cookies in storage`);
				}
			} catch (err) {
				// eslint-disable-next-line no-console
				console.warn(`${label} Failed to parse auth file ${authFile}:`, err);
			}
		}

		// Create context with storage state if available
		const context: BrowserContext = storageState
			? await browser.newContext({ storageState })
			: await browser.newContext();

		const page = await context.newPage();

		// eslint-disable-next-line no-console
		console.log(`${label} Navigating to /admin...`);

		// Navigate to admin
		await page.goto('/admin');

		// Wait for auth state to settle after client-side hydration
		const authState = await waitForAuthState(page);
		// eslint-disable-next-line no-console
		console.log(`${label} Auth state: ${authState}`);

		// If on login page, the session is invalid - log in via API
		if (authState === 'login') {
			// eslint-disable-next-line no-console
			console.log(`${label} On login page, signing in via API...`);

			const signInResponse = await context.request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: credentials.email,
					password: credentials.password,
				},
			});

			if (!signInResponse.ok()) {
				throw new Error(
					`${label} Sign-in failed: ${signInResponse.status()} ${await signInResponse.text()}`,
				);
			}

			// Refresh to load with new session
			await page.goto('/admin');
			await page.waitForLoadState('networkidle');

			const postLoginState = await waitForAuthState(page);
			// eslint-disable-next-line no-console
			console.log(`${label} Post-login state: ${postLoginState}`);

			if (postLoginState !== 'authenticated') {
				throw new Error(`${label} Login failed. State: ${postLoginState}`);
			}

			// Save updated session
			await context.storageState({ path: authFile });
			// eslint-disable-next-line no-console
			console.log(`${label} Saved new session to storage file`);
		} else if (authState === 'setup') {
			throw new Error(
				`${label} Unexpected: no users exist. Run tests with global setup enabled.`,
			);
		} else {
			// eslint-disable-next-line no-console
			console.log(`${label} Already authenticated`);
		}

		// eslint-disable-next-line no-console
		console.log(`${label} Passing authenticated page to test`);

		await use(page);

		// Clean up
		await context.close();
	};
}

/**
 * Extended test fixtures with per-role authenticated pages.
 * Each fixture creates a browser context logged in as the specified role.
 */
export const test = base.extend<{
	authenticatedPage: Page;
	editorPage: Page;
	viewerPage: Page;
	author1Page: Page;
	author2Page: Page;
	author3Page: Page;
}>({
	authenticatedPage: createAuthPageFixture(TEST_CREDENTIALS),
	editorPage: createAuthPageFixture(TEST_EDITOR_CREDENTIALS),
	viewerPage: createAuthPageFixture(TEST_VIEWER_CREDENTIALS),
	author1Page: createAuthPageFixture(TEST_AUTHOR1_CREDENTIALS),
	author2Page: createAuthPageFixture(TEST_AUTHOR2_CREDENTIALS),
	author3Page: createAuthPageFixture(TEST_AUTHOR3_CREDENTIALS),
});

export { expect };
export {
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
};

/* eslint-disable no-console */
import type { Page, BrowserContext } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

/** Auth state after SSR hydration settles. */
export type AuthState = 'setup' | 'login' | 'authenticated';

/**
 * Wait for the page to settle on a final auth state.
 * With SSR, the server may return one page but client-side redirects to another.
 *
 * Extracted from both E2E apps to eliminate duplication and anti-patterns.
 */
export async function waitForAuthState(page: Page, timeout = 30000): Promise<AuthState> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		await page.waitForLoadState('networkidle');

		const url = page.url();

		if (url.includes('/setup')) {
			const nameField = page.getByLabel(/full name/i);
			if (await nameField.isVisible()) {
				return 'setup';
			}
		} else if (url.includes('/login')) {
			const emailField = page.getByLabel(/email/i);
			if (await emailField.isVisible()) {
				return 'login';
			}
		} else if (url.includes('/admin')) {
			const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
			if (await dashboardHeading.isVisible()) {
				return 'authenticated';
			}
		}

		// Brief polling interval
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

/**
 * Get the worker-scoped auth directory.
 * Each worker stores auth state in its own subdirectory to avoid conflicts.
 */
export function getWorkerAuthDir(projectDir: string, workerIndex: number): string {
	return path.join(projectDir, `playwright/.auth/worker-${workerIndex}`);
}

/**
 * Get the auth state file path for a specific user in a specific worker.
 */
export function getWorkerAuthFilePath(
	projectDir: string,
	workerIndex: number,
	email: string,
): string {
	const sanitized = email.replace(/[@.]/g, '-');
	return path.join(getWorkerAuthDir(projectDir, workerIndex), `${sanitized}.json`);
}

/**
 * Create an authenticated page fixture for a given set of credentials.
 * Loads stored auth state if available, falls back to API sign-in.
 *
 * @param credentials - The user credentials to authenticate with
 * @param getAuthFile - Function that returns the auth file path for this context
 */
export function createAuthPageFixture(
	credentials: TestUserCredentials,
	getAuthFile: () => string,
): (
	args: { browser: import('@playwright/test').Browser },
	use: (page: Page) => Promise<void>,
) => Promise<void> {
	return async ({ browser }, use) => {
		const label = `[Auth:${credentials.role}]`;
		console.log(`${label} Starting fixture for ${credentials.email}...`);

		const authFile = getAuthFile();

		// Try to load storage state if it exists
		let storageState: string | undefined;
		if (fs.existsSync(authFile)) {
			try {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Reading JSON auth file
				const content = JSON.parse(fs.readFileSync(authFile, 'utf-8')) as {
					cookies?: unknown[];
				};
				if (content.cookies && content.cookies.length > 0) {
					storageState = authFile;
					console.log(`${label} Found ${content.cookies.length} cookies in storage`);
				}
			} catch (err) {
				console.warn(`${label} Failed to parse auth file ${authFile}:`, err);
			}
		}

		// Create context with storage state if available
		const context: BrowserContext = storageState
			? await browser.newContext({ storageState })
			: await browser.newContext();

		const page = await context.newPage();

		console.log(`${label} Navigating to /admin...`);
		await page.goto('/admin');

		const authState = await waitForAuthState(page);
		console.log(`${label} Auth state: ${authState}`);

		if (authState === 'login') {
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

			await page.goto('/admin');
			await page.waitForLoadState('networkidle');

			const postLoginState = await waitForAuthState(page);
			console.log(`${label} Post-login state: ${postLoginState}`);

			if (postLoginState !== 'authenticated') {
				throw new Error(`${label} Login failed. State: ${postLoginState}`);
			}

			// Save updated session
			await context.storageState({ path: authFile });
			console.log(`${label} Saved new session to storage file`);
		} else if (authState === 'setup') {
			throw new Error(
				`${label} Unexpected: no users exist. Worker fixture should have created them.`,
			);
		} else {
			console.log(`${label} Already authenticated`);
		}

		console.log(`${label} Passing authenticated page to test`);
		await use(page);
		await context.close();
	};
}

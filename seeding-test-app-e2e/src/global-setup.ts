/* eslint-disable no-console */
import { chromium, type FullConfig } from '@playwright/test';
import * as path from 'path';
import { waitForAuthState, TEST_CREDENTIALS } from './fixtures/e2e-utils';

const MAX_WAIT_TIME = 60000; // 60 seconds max wait for seeds
const POLL_INTERVAL = 1000; // Poll every second

// Auth file path for storing session state
const AUTH_FILE = path.join(__dirname, '..', 'playwright/.auth/user.json');

// Mailpit API for password reset recovery
const MAILPIT_API = 'http://localhost:8025/api/v1';

/**
 * Wait for seeding to complete via health endpoint.
 */
async function waitForSeeds(baseURL: string): Promise<void> {
	console.log('[Seeding E2E] Waiting for server and seeds to be ready...');

	const startTime = Date.now();
	let lastError: Error | null = null;

	while (Date.now() - startTime < MAX_WAIT_TIME) {
		try {
			const response = await fetch(`${baseURL}/api/health?checkSeeds=true`);

			if (response.ok) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for response validation
				const data = (await response.json()) as {
					status: string;
					seeds?: { completed: number; expected: number; ready: boolean };
				};

				if (data.seeds?.ready) {
					console.log(
						`[Seeding E2E] Seeds ready: ${data.seeds.completed}/${data.seeds.expected} seeds completed`,
					);
					return;
				}

				console.log(
					`[Seeding E2E] Seeds not ready yet: ${data.seeds?.completed ?? 0}/${data.seeds?.expected ?? 0}`,
				);
			} else {
				console.log(`[Seeding E2E] Health check returned ${response.status}, retrying...`);
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			console.log(`[Seeding E2E] Server not ready yet: ${lastError.message}`);
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
	}

	throw new Error(
		`[Seeding E2E] Timed out waiting for seeds to complete after ${MAX_WAIT_TIME}ms. Last error: ${lastError?.message}`,
	);
}

/**
 * Recover the admin password via password reset flow.
 * This handles the case where a previous test run changed the password.
 */
async function recoverPasswordViaReset(baseURL: string): Promise<boolean> {
	console.log('[Auth Setup] Attempting password recovery via reset flow...');

	try {
		// Clear any existing emails in Mailpit
		await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Request password reset
		const resetRequestResponse = await fetch(`${baseURL}/api/auth/request-password-reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: TEST_CREDENTIALS.email,
				redirectTo: `${baseURL}/admin/reset-password`,
			}),
		});

		if (!resetRequestResponse.ok) {
			console.log('[Auth Setup] Password reset request failed:', resetRequestResponse.status);
			return false;
		}

		// Wait for email to arrive in Mailpit
		let email: { ID: string } | undefined;
		const maxWaitTime = 15000;
		const startTime = Date.now();

		while (Date.now() - startTime < maxWaitTime) {
			const messagesResponse = await fetch(
				`${MAILPIT_API}/search?query=to:${TEST_CREDENTIALS.email} subject:reset`,
			);
			if (messagesResponse.ok) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mailpit API response
				const data = (await messagesResponse.json()) as { messages: Array<{ ID: string }> };
				if (data.messages && data.messages.length > 0) {
					email = data.messages[0];
					break;
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		if (!email) {
			console.log('[Auth Setup] No reset email received');
			return false;
		}

		// Get email content
		const emailDetailResponse = await fetch(`${MAILPIT_API}/message/${email.ID}`);
		if (!emailDetailResponse.ok) {
			console.log('[Auth Setup] Failed to get email details');
			return false;
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mailpit API response
		const emailDetail = (await emailDetailResponse.json()) as { HTML: string };
		const resetUrlMatch = emailDetail.HTML.match(/href="([^"]*reset-password[^"]*)"/);
		const resetUrl = resetUrlMatch?.[1]?.replace(/&amp;/g, '&');

		if (!resetUrl) {
			console.log('[Auth Setup] No reset URL found in email');
			return false;
		}

		// Extract token from URL
		const urlObj = new URL(resetUrl);
		const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
		const token = pathMatch ? pathMatch[1] : urlObj.searchParams.get('token');

		if (!token) {
			console.log('[Auth Setup] No token found in reset URL');
			return false;
		}

		// Reset password via API
		const resetResponse = await fetch(`${baseURL}/api/auth/reset-password`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token, newPassword: TEST_CREDENTIALS.password }),
		});

		if (!resetResponse.ok) {
			console.log('[Auth Setup] Password reset failed:', resetResponse.status);
			return false;
		}

		console.log('[Auth Setup] Password recovered successfully');
		return true;
	} catch (error) {
		console.log('[Auth Setup] Password recovery failed:', error);
		return false;
	}
}

/**
 * Global setup for E2E tests.
 *
 * 1. Waits for seeding process to complete
 * 2. Creates test admin user if one doesn't exist
 * 3. Saves authentication state for other tests to reuse
 */
async function globalSetup(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:4001';

	// Step 1: Wait for seeding to complete
	await waitForSeeds(baseURL);

	// Step 2: Set up authentication
	console.log('[Auth Setup] Creating admin user and saving auth state...');

	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		// Navigate to admin
		console.log('[Auth Setup] Navigating to /admin...');
		await page.goto(`${baseURL}/admin`);

		// Wait for auth state to stabilize after client-side hydration
		let authState = await waitForAuthState(page);
		console.log(`[Auth Setup] Auth state: ${authState}`);

		// SSR renders dashboard without auth (guards allow during SSR)
		// We need to verify cookies actually exist, not just trust the UI
		if (authState === 'authenticated') {
			const cookies = await context.cookies();
			console.log(`[Auth Setup] Cookies found: ${cookies.length}`);
			if (cookies.length === 0) {
				// SSR rendered dashboard but no actual auth
				// Navigate to login page directly to force proper auth flow
				console.log('[Auth Setup] No cookies found - navigating to login page...');
				await page.goto(`${baseURL}/admin/login`);
				authState = await waitForAuthState(page);
				console.log(`[Auth Setup] Auth state after navigating to login: ${authState}`);
			}
		}

		if (authState === 'setup') {
			// No users exist - create the first admin user
			console.log('[Auth Setup] Creating test admin user...');

			await page.getByLabel(/full name/i).fill(TEST_CREDENTIALS.name);
			await page.getByLabel(/email address/i).fill(TEST_CREDENTIALS.email);
			await page.getByRole('textbox', { name: /^password$/i }).fill(TEST_CREDENTIALS.password);
			await page
				.getByRole('textbox', { name: /confirm password/i })
				.fill(TEST_CREDENTIALS.password);

			// Wait for button to be enabled
			const submitButton = page.getByRole('button', { name: /create|submit|sign up/i });
			await submitButton.click();

			// Wait for redirect to admin dashboard
			await page.waitForURL(/\/admin(?!\/setup|\/login)/, { timeout: 30000 });
			console.log('[Auth Setup] Admin user created and logged in');
		} else if (authState === 'login') {
			// Users exist but not logged in - login with test credentials via API
			console.log('[Auth Setup] Logging in with test admin via API...');

			// Use Better Auth's sign-in API directly - more reliable than UI
			let signInResponse = await context.request.post(`${baseURL}/api/auth/sign-in/email`, {
				headers: {
					'Content-Type': 'application/json',
				},
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});

			console.log(`[Auth Setup] Sign-in API response status: ${signInResponse.status()}`);

			// If login fails (wrong password), try to recover via password reset
			if (!signInResponse.ok()) {
				const errorBody = await signInResponse.text();
				console.log('[Auth Setup] Sign-in failed, attempting password recovery...');

				// Check if this looks like a password mismatch
				if (errorBody.includes('INVALID_EMAIL_OR_PASSWORD')) {
					const recovered = await recoverPasswordViaReset(baseURL);

					if (recovered) {
						// Retry login with recovered password
						signInResponse = await context.request.post(`${baseURL}/api/auth/sign-in/email`, {
							headers: {
								'Content-Type': 'application/json',
							},
							data: {
								email: TEST_CREDENTIALS.email,
								password: TEST_CREDENTIALS.password,
							},
						});
						console.log(`[Auth Setup] Retry sign-in status: ${signInResponse.status()}`);
					}
				}

				if (!signInResponse.ok()) {
					console.error('[Auth Setup] Sign-in API error:', errorBody);
					throw new Error(`Failed to sign in via API: ${signInResponse.status()} - ${errorBody}`);
				}
			}

			// The API sets cookies automatically via Set-Cookie headers
			// Refresh the page to load with the new session
			await page.goto(`${baseURL}/admin`);
			await page.waitForLoadState('networkidle');

			// Verify we're now on the dashboard
			const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
			await dashboardHeading.waitFor({ state: 'visible', timeout: 10000 });
			console.log('[Auth Setup] Logged in successfully via API');
		} else {
			// Already authenticated with valid cookies
			console.log('[Auth Setup] Already authenticated');
		}

		// Verify cookies exist before saving
		const finalCookies = await context.cookies();
		console.log(`[Auth Setup] Final cookies count: ${finalCookies.length}`);
		if (finalCookies.length === 0) {
			throw new Error('[Auth Setup] Authentication failed - no cookies to save');
		}

		// Save the authentication state
		await context.storageState({ path: AUTH_FILE });
		console.log(`[Auth Setup] Authentication state saved to ${AUTH_FILE}`);
	} catch (error) {
		console.error('[Auth Setup] Global setup failed:', error);
		throw error;
	} finally {
		await browser.close();
	}
}

export default globalSetup;

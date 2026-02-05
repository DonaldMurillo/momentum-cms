/* eslint-disable no-console */
import { chromium, type FullConfig } from '@playwright/test';
import { Pool } from 'pg';
import {
	waitForAuthState,
	TEST_CREDENTIALS,
	ADDITIONAL_TEST_USERS,
	getAuthFilePath,
	type TestUserCredentials,
} from './fixtures/e2e-utils';

const MAX_WAIT_TIME = 60000; // 60 seconds max wait for seeds
const POLL_INTERVAL = 1000; // Poll every second

// Admin auth file path (uses the same getAuthFilePath from e2e-utils)
const ADMIN_AUTH_FILE = getAuthFilePath(TEST_CREDENTIALS.email);

// Mailpit API for password reset recovery
const MAILPIT_API = 'http://localhost:8025/api/v1';

// Database connection for direct role fixes (bypasses API access control)
const DATABASE_URL =
	process.env['DATABASE_URL'] ??
	'postgresql://postgres:postgres@localhost:5434/momentum_seeding_test';

/**
 * Ensure a user exists in the Momentum users collection with the correct role.
 * Uses direct database access to bypass API access control.
 * This handles the chicken-and-egg problem where admin needs 'admin' role to
 * PATCH users, but the session resolver reads role from the Momentum collection.
 */
async function ensureMomentumUser(
	pool: Pool,
	credentials: TestUserCredentials,
	authUserId?: string,
): Promise<void> {
	// Check if user already exists
	const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [
		credentials.email,
	]);

	if (existing.rows.length > 0) {
		// User exists - update role if needed
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row
		const row = existing.rows[0] as { id: string; role: string };
		if (row.role !== credentials.role) {
			await pool.query('UPDATE users SET role = $1 WHERE id = $2', [
				credentials.role,
				row.id,
			]);
			console.log(
				`[Auth Setup] Fixed ${credentials.email} role: ${row.role} → ${credentials.role}`,
			);
		}
	} else {
		// User doesn't exist - create them.
		// Look up Better Auth user ID if not provided.
		let resolvedAuthId = authUserId;
		if (!resolvedAuthId) {
			const authLookup = await pool.query(
				'SELECT id FROM "user" WHERE email = $1',
				[credentials.email],
			);
			if (authLookup.rows.length > 0) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row
				resolvedAuthId = (authLookup.rows[0] as { id: string }).id;
			}
		}

		await pool.query(
			`INSERT INTO users (id, name, email, role, "authId", active, "createdAt", "updatedAt")
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
			[credentials.name, credentials.email, credentials.role, resolvedAuthId ?? ''],
		);
		console.log(
			`[Auth Setup] Created Momentum user: ${credentials.email} (${credentials.role})`,
		);
	}
}

/**
 * Ensure all test users exist in the Momentum users collection with correct roles.
 * Uses direct database access to bypass API access control.
 */
async function ensureAllMomentumUsers(
	authUserIds: Map<string, string>,
): Promise<void> {
	const pool = new Pool({ connectionString: DATABASE_URL });
	try {
		const allUsers = [TEST_CREDENTIALS, ...ADDITIONAL_TEST_USERS];
		for (const user of allUsers) {
			await ensureMomentumUser(pool, user, authUserIds.get(user.email));
		}
	} catch (error) {
		console.warn('[Auth Setup] Momentum user sync failed:', error);
	} finally {
		await pool.end();
	}
}

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
 * Create an additional test user via Better Auth sign-up API.
 * If the user already exists (sign-up returns 409 or similar), sign in instead.
 * Saves auth state to a per-user file for test fixtures to load.
 * Returns the Better Auth user ID for Momentum collection linking.
 */
async function ensureTestUser(
	baseURL: string,
	credentials: TestUserCredentials,
): Promise<string | undefined> {
	const userAuthFile = getAuthFilePath(credentials.email);
	console.log(`[Auth Setup] Ensuring user ${credentials.email} (${credentials.role})...`);

	const browser = await chromium.launch();
	const context = await browser.newContext();
	let authUserId: string | undefined;

	try {
		// Try to sign up the user via Better Auth
		const signUpResponse = await context.request.post(`${baseURL}/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: credentials.name,
				email: credentials.email,
				password: credentials.password,
			},
		});

		if (signUpResponse.ok()) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth response
			const signUpData = (await signUpResponse.json()) as {
				user?: { id?: string };
			};
			authUserId = signUpData.user?.id;
			console.log(`[Auth Setup] User ${credentials.email} created in Better Auth`);
		} else {
			// User likely already exists - try to sign in
			console.log(
				`[Auth Setup] Sign-up returned ${signUpResponse.status()}, trying sign-in...`,
			);
			const signInResponse = await context.request.post(
				`${baseURL}/api/auth/sign-in/email`,
				{
					headers: { 'Content-Type': 'application/json' },
					data: {
						email: credentials.email,
						password: credentials.password,
					},
				},
			);

			if (!signInResponse.ok()) {
				throw new Error(
					`Failed to sign in ${credentials.email}: ${signInResponse.status()} ${await signInResponse.text()}`,
				);
			}
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth response
			const signInData = (await signInResponse.json()) as {
				user?: { id?: string };
			};
			authUserId = signInData.user?.id;
			console.log(`[Auth Setup] User ${credentials.email} signed in`);
		}

		// Save the user's auth state
		await context.storageState({ path: userAuthFile });
		console.log(`[Auth Setup] Saved auth state for ${credentials.email}`);
	} finally {
		await browser.close();
	}

	return authUserId;
}

/**
 * Global setup for E2E tests.
 *
 * 1. Waits for seeding process to complete
 * 2. Creates test admin user if one doesn't exist
 * 3. Creates additional test users (editor, viewer, authors)
 * 4. Saves authentication state for other tests to reuse
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
		await context.storageState({ path: ADMIN_AUTH_FILE });
		console.log(`[Auth Setup] Authentication state saved to ${ADMIN_AUTH_FILE}`);

	} catch (error) {
		console.error('[Auth Setup] Global setup failed:', error);
		throw error;
	} finally {
		await browser.close();
	}

	// Step 3: Create additional test users in Better Auth (editor, viewer, authors)
	console.log('[Auth Setup] Creating additional test users...');
	const authUserIds = new Map<string, string>();
	for (const userCreds of ADDITIONAL_TEST_USERS) {
		try {
			const authId = await ensureTestUser(baseURL, userCreds);
			if (authId) {
				authUserIds.set(userCreds.email, authId);
			}
		} catch (error) {
			console.warn(
				`[Auth Setup] Failed to create user ${userCreds.email}:`,
				error instanceof Error ? error.message : error,
			);
			// Non-fatal: continue with other users
		}
	}
	console.log('[Auth Setup] Additional test users setup complete');

	// Step 4: Ensure all users exist in Momentum users collection with correct roles.
	// Uses direct database access to bypass API access control (chicken-and-egg problem:
	// admin needs 'admin' role to manage users, but session resolver reads role from Momentum).
	console.log('[Auth Setup] Syncing Momentum users collection...');
	await ensureAllMomentumUsers(authUserIds);
	console.log('[Auth Setup] Momentum users synced');
}

export default globalSetup;

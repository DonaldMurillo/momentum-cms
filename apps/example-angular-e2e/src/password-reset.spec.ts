import { test, expect } from '@playwright/test';

/**
 * Password Reset E2E Tests
 *
 * Tests the password reset flow using Mailpit for email capture.
 *
 * Prerequisites:
 * - Mailpit running on localhost:8025 (web) and localhost:1025 (SMTP)
 * - SMTP_HOST=localhost set in environment
 * - Test user exists (created by global setup)
 */

// Mailpit API endpoint
const MAILPIT_API = 'http://localhost:8025/api/v1';

// Base URL for API calls (matches playwright config)
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:4000';

// Test credentials from global setup
const TEST_USER = {
	email: 'admin@test.com',
	password: 'TestPassword123!',
	newPassword: 'NewPassword456!',
};

/**
 * Check if Mailpit is running and accessible
 */
async function checkMailpitHealth(): Promise<void> {
	try {
		const response = await fetch(`${MAILPIT_API}/messages`);
		if (!response.ok) {
			throw new Error(`Mailpit returned ${response.status}`);
		}
	} catch (err) {
		throw new Error(
			`Mailpit is not running at ${MAILPIT_API}. ` +
				`Start it with: docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit\n` +
				`Error: ${err}`,
		);
	}
}

/**
 * Helper to clear all emails from Mailpit
 */
async function clearMailpit(): Promise<void> {
	try {
		await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
	} catch (err) {
		throw new Error(`Failed to clear Mailpit messages: ${err}`);
	}
}

/**
 * Helper to get emails from Mailpit
 */
async function getEmails(): Promise<MailpitMessage[]> {
	const response = await fetch(`${MAILPIT_API}/messages`);
	const data = (await response.json()) as MailpitMessagesResponse;
	return data.messages || [];
}

/**
 * Helper to get a specific email by ID
 */
async function getEmailById(id: string): Promise<MailpitMessageDetail> {
	const response = await fetch(`${MAILPIT_API}/message/${id}`);
	return (await response.json()) as MailpitMessageDetail;
}

/**
 * Helper to wait for an email to arrive
 */
async function waitForEmail(
	toEmail: string,
	subjectContains: string,
	timeout = 10000,
): Promise<MailpitMessage> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const emails = await getEmails();
		const email = emails.find(
			(e) =>
				e.To.some((t) => t.Address === toEmail) &&
				e.Subject.toLowerCase().includes(subjectContains.toLowerCase()),
		);

		if (email) {
			return email;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(
		`Timeout waiting for email to ${toEmail} with subject containing "${subjectContains}"`,
	);
}

/**
 * Extract reset URL from email body and validate it has a token.
 * Better Auth generates URLs in format: {baseURL}/reset-password/{token}?callbackURL=...
 * The token is in the path, not query params. Returns the full URL for navigation.
 */
function extractResetUrl(htmlBody: string): string | null {
	// Look for the reset URL in the HTML
	// The email template contains: <a href="URL" ...>Reset Password</a>
	// Better Auth URL format: /reset-password/{token}?callbackURL=...
	const match = htmlBody.match(/href="([^"]*reset-password[^"]*)"/);
	if (match) {
		const url = match[1];
		try {
			const urlObj = new URL(url);
			// Check for token in path (Better Auth format) or query params (final redirect)
			const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
			if (pathMatch || urlObj.searchParams.has('token')) {
				return url;
			}
		} catch {
			// Invalid URL, try next pattern
		}
	}

	// Also try plain text URL pattern
	const textMatch = htmlBody.match(/(https?:\/\/[^\s<>"]*reset-password[^\s<>"]*)/);
	if (textMatch) {
		const url = textMatch[1];
		try {
			const urlObj = new URL(url);
			const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
			if (pathMatch || urlObj.searchParams.has('token')) {
				return url;
			}
		} catch {
			// Invalid URL
		}
	}

	return null;
}

// Mailpit types
interface MailpitAddress {
	Name: string;
	Address: string;
}

interface MailpitMessage {
	ID: string;
	MessageID: string;
	From: MailpitAddress;
	To: MailpitAddress[];
	Subject: string;
	Created: string;
}

interface MailpitMessagesResponse {
	total: number;
	unread: number;
	messages: MailpitMessage[];
}

interface MailpitMessageDetail {
	ID: string;
	MessageID: string;
	From: MailpitAddress;
	To: MailpitAddress[];
	Subject: string;
	Text: string;
	HTML: string;
}

test.describe('Password Reset Flow', () => {
	test.beforeAll(async () => {
		// Verify Mailpit is running before tests start
		await checkMailpitHealth();
	});

	test.beforeEach(async () => {
		// Clear Mailpit before each test
		await clearMailpit();
	});

	test.describe('Forgot Password Page', () => {
		test('should display forgot password form', async ({ page }) => {
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');

			// Should show the forgot password form
			await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
			await expect(page.getByLabel(/email/i)).toBeVisible();
			await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /back to sign in/i })).toBeVisible();
		});

		test('should have back to login link that works', async ({ page }) => {
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');

			await page.getByText(/back to sign in/i).click();
			await page.waitForURL(/\/admin\/login/);

			expect(page.url()).toContain('/admin/login');
		});

		test('should show success message after submitting email', async ({ page }) => {
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');

			// Fill and submit the form
			await page.getByLabel(/email/i).fill(TEST_USER.email);
			await page.getByRole('button', { name: /send reset link/i }).click();

			// Should show success message
			await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
			await expect(page.getByText(/reset link/i)).toBeVisible();
		});

		test('should send password reset email via Mailpit', async ({ page }) => {
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');

			// Submit the form
			await page.getByLabel(/email/i).fill(TEST_USER.email);
			await page.getByRole('button', { name: /send reset link/i }).click();

			// Wait for success message
			await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });

			// Check Mailpit for the email
			const email = await waitForEmail(TEST_USER.email, 'reset');
			expect(email).toBeDefined();
			expect(email.Subject.toLowerCase()).toContain('reset');

			// Get the full email content
			const emailDetail = await getEmailById(email.ID);
			expect(emailDetail.HTML).toContain('Reset Password');
			expect(emailDetail.HTML).toContain('reset-password');
		});
	});

	test.describe('Reset Password Page', () => {
		test('should show error for missing token', async ({ page }) => {
			await page.goto('/admin/reset-password');
			await page.waitForLoadState('networkidle');

			// Should show invalid token message
			await expect(page.getByText(/invalid|missing.*token/i)).toBeVisible();
			await expect(page.getByRole('button', { name: /request new link/i })).toBeVisible();
		});

		test('should display reset form with valid token', async ({ page }) => {
			// First, request a password reset
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');
			await page.getByLabel(/email/i).fill(TEST_USER.email);
			await page.getByRole('button', { name: /send reset link/i }).click();
			await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });

			// Get the reset URL from email
			const email = await waitForEmail(TEST_USER.email, 'reset');
			const emailDetail = await getEmailById(email.ID);
			const resetUrl = extractResetUrl(emailDetail.HTML);

			expect(resetUrl).toBeDefined();
			if (!resetUrl) throw new Error('Reset URL not found in email');

			// Navigate to the reset URL
			await page.goto(resetUrl);
			await page.waitForLoadState('networkidle');

			// Should show the reset form
			await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible();
			await expect(page.getByLabel(/new password/i)).toBeVisible();
			await expect(page.getByLabel(/confirm password/i)).toBeVisible();
			await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
		});
	});

	test.describe('Full Password Reset Flow', () => {
		// This test modifies the user's password - run it last or reset after
		test('should complete full password reset flow', async ({ page, context }) => {
			// 1. Request password reset
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');
			await page.getByLabel(/email/i).fill(TEST_USER.email);
			await page.getByRole('button', { name: /send reset link/i }).click();
			await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });

			// 2. Get reset URL from email
			const email = await waitForEmail(TEST_USER.email, 'reset');
			const emailDetail = await getEmailById(email.ID);
			const resetUrl = extractResetUrl(emailDetail.HTML);
			expect(resetUrl).toBeDefined();

			if (!resetUrl) throw new Error('Reset URL not found in email');

			// 3. Navigate to reset page and submit new password
			await page.goto(resetUrl);
			await page.waitForLoadState('networkidle');

			await page.getByLabel(/new password/i).fill(TEST_USER.newPassword);
			await page.getByLabel(/confirm password/i).fill(TEST_USER.newPassword);
			await page.getByRole('button', { name: /reset password/i }).click();

			// 4. Should show success message
			await expect(page.getByText(/password reset successful/i)).toBeVisible({ timeout: 10000 });

			// 5. Click go to sign in
			await page.getByRole('button', { name: /go to sign in/i }).click();
			await page.waitForURL(/\/admin\/login/);

			// 6. Login with new password
			await page.getByLabel(/email/i).fill(TEST_USER.email);
			await page.getByLabel(/password/i).fill(TEST_USER.newPassword);
			await page.getByRole('button', { name: /sign in/i }).click();

			// 7. Should be redirected to dashboard
			await page.waitForURL(/\/admin(?!\/login|\/setup)/, { timeout: 15000 });
			await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
				timeout: 10000,
			});

			// 8. Reset password back to original for other tests
			// Use the API directly to avoid UI complexity
			// Wrap in try/catch so test doesn't fail if cleanup fails
			try {
				// Wait for session to stabilize before cleanup
				await page.waitForTimeout(2000);
				await clearMailpit();

				// Wait a bit after clearing
				await page.waitForTimeout(500);

				const resetResponse = await context.request.post(
					`${BASE_URL}/api/auth/request-password-reset`,
					{
						headers: { 'Content-Type': 'application/json' },
						data: {
							email: TEST_USER.email,
							redirectTo: `${BASE_URL}/admin/reset-password`,
						},
					},
				);

				console.log('[Cleanup] Password reset request status:', resetResponse.status());

				const resetEmail = await waitForEmail(TEST_USER.email, 'reset', 20000);
				const resetEmailDetail = await getEmailById(resetEmail.ID);
				const newResetUrl = extractResetUrl(resetEmailDetail.HTML);

				if (newResetUrl) {
					// Extract token from URL path (Better Auth format: /reset-password/{token})
					const urlObj = new URL(newResetUrl);
					const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
					const token = pathMatch ? pathMatch[1] : urlObj.searchParams.get('token');

					if (token) {
						const resetResult = await context.request.post(`${BASE_URL}/api/auth/reset-password`, {
							headers: { 'Content-Type': 'application/json' },
							data: { token, newPassword: TEST_USER.password },
						});

						console.log('[Cleanup] Password reset result:', resetResult.status());
					}
				}
			} catch (cleanupError) {
				// Log but don't fail the test - password may need manual reset

				console.error('[Cleanup] Failed (password may still be changed):', cleanupError);
			}
		});
	});

	test.describe('Security', () => {
		test('should return success for non-existent email (prevent enumeration)', async ({ page }) => {
			await page.goto('/admin/forgot-password');
			await page.waitForLoadState('networkidle');

			// Request reset for non-existent email
			await page.getByLabel(/email/i).fill('nonexistent@example.com');
			await page.getByRole('button', { name: /send reset link/i }).click();

			// Should still show success message (no indication email doesn't exist)
			await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });

			// Wait a bit for any email to arrive
			await page.waitForTimeout(2000);

			// Verify no email was actually sent
			const emails = await getEmails();
			const matchingEmails = emails.filter((e) =>
				e.To.some((t) => t.Address === 'nonexistent@example.com'),
			);
			expect(matchingEmails.length).toBe(0);
		});
	});

	test.describe('Login Page Integration', () => {
		test('login page should have forgot password link', async ({ page }) => {
			await page.goto('/admin/login');
			await page.waitForLoadState('networkidle');

			// Check for forgot password link
			const forgotLink = page.getByRole('link', { name: /forgot.*password/i });
			await expect(forgotLink).toBeVisible();

			// Click the link
			await forgotLink.click();
			await page.waitForURL(/\/admin\/forgot-password/);

			expect(page.url()).toContain('/forgot-password');
		});
	});
});

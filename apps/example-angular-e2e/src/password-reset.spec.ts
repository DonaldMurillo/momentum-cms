import { test, expect, TEST_CREDENTIALS } from './fixtures';
import {
	checkMailpitHealth,
	clearMailpit,
	getEmails,
	getEmailById,
	waitForEmail,
	extractResetUrl,
} from './fixtures/mailpit-helpers';

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

// Extend shared credentials with the new password used in reset tests
const TEST_USER = {
	...TEST_CREDENTIALS,
	newPassword: 'NewPassword456!',
};

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
				await new Promise((resolve) => setTimeout(resolve, 2000));
				await clearMailpit();

				// Wait a bit after clearing
				await new Promise((resolve) => setTimeout(resolve, 500));

				const resetResponse = await context.request.post(`/api/auth/request-password-reset`, {
					headers: { 'Content-Type': 'application/json' },
					data: {
						email: TEST_USER.email,
						redirectTo: `/admin/reset-password`,
					},
				});

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
						const resetResult = await context.request.post(`/api/auth/reset-password`, {
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

			// Allow time for any email delivery (intentional wait for negative proof)
			await new Promise((resolve) => setTimeout(resolve, 2000));

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

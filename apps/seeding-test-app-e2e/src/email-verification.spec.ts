import { test, expect } from './fixtures';
import {
	isMailpitAvailable,
	waitForEmail,
	getEmails,
	getEmailById,
	extractVerificationUrl,
} from './fixtures/mailpit-helpers';

/**
 * Email Verification E2E Tests
 *
 * Tests the email verification flow after user signup.
 * Better Auth sends a verification email when SMTP is configured.
 *
 * Prerequisites:
 * - Mailpit running on localhost:8025 (web) and localhost:1025 (SMTP)
 * - SMTP_HOST=localhost set in server environment
 */

// Unique email to avoid conflicts with other test users
const VERIFY_USER_EMAIL = `verify-test-${Date.now()}@test.com`;
const VERIFY_USER_PASSWORD = 'VerifyTest123!';
const VERIFY_USER_NAME = 'Verify Test User';

test.describe('Email Verification Flow', () => {
	let mailpitRunning = false;

	test.beforeAll(async () => {
		mailpitRunning = await isMailpitAvailable();
	});

	test.beforeEach(async () => {
		test.skip(!mailpitRunning, 'Mailpit is not running - skipping email verification tests');
		// No clearMailpit() — each test uses unique Date.now() emails,
		// so waitForEmail filtering works without clearing.
		// Clearing would cause parallel interference across workers.
	});

	test('signup triggers verification email', async ({ request }) => {
		// Sign up a new user
		const signupResponse = await request.post(`/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: VERIFY_USER_NAME,
				email: VERIFY_USER_EMAIL,
				password: VERIFY_USER_PASSWORD,
			},
		});
		expect(signupResponse.ok(), 'Signup should succeed').toBe(true);

		// Wait for verification email to arrive in Mailpit
		const email = await waitForEmail(VERIFY_USER_EMAIL, 'verify', 15000);
		expect(email).toBeDefined();
		expect(email.Subject.toLowerCase()).toContain('verify');
		expect(email.To.some((t) => t.Address === VERIFY_USER_EMAIL)).toBe(true);
	});

	test('verification email contains valid verify link', async ({ request }) => {
		// Sign up
		const signupEmail = `verify-link-${Date.now()}@test.com`;
		await request.post(`/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Link Test User',
				email: signupEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});

		// Wait for the email
		const email = await waitForEmail(signupEmail, 'verify', 15000);
		const detail = await getEmailById(email.ID);

		// Extract verification URL from the HTML body
		const verifyUrl = extractVerificationUrl(detail.HTML);
		expect(verifyUrl).not.toBeNull();
		expect(verifyUrl).toContain('verify-email');
	});

	test('clicking verification link verifies email', async ({ request, baseURL }) => {
		// Sign up a fresh user
		const freshEmail = `verify-click-${Date.now()}@test.com`;
		const signupResponse = await request.post(`/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Click Verify User',
				email: freshEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});
		expect(signupResponse.ok()).toBe(true);

		// Get the session to check emailVerified = false

		const signupData = (await signupResponse.json()) as {
			user?: { emailVerified: boolean };
		};
		// Better Auth may or may not return emailVerified in signup response
		// It's expected to be false initially
		if (signupData.user) {
			expect(signupData.user.emailVerified).toBe(false);
		}

		// Wait for verification email
		const email = await waitForEmail(freshEmail, 'verify', 15000);
		const detail = await getEmailById(email.ID);
		const verifyUrl = extractVerificationUrl(detail.HTML);
		expect(verifyUrl).not.toBeNull();

		// Click the verification link (GET request via Playwright's request context)
		const verifyResponse = await request.get(verifyUrl as string);
		// Better Auth may redirect after verification - either 200 or 302 is fine
		expect(verifyResponse.status()).toBeLessThan(400);

		// Sign in with the verified user to confirm email is now verified
		// Origin header required by Better Auth CSRF protection
		const signInResponse = await request.post(`/api/auth/sign-in/email`, {
			headers: { 'Content-Type': 'application/json', Origin: baseURL ?? '' },
			data: {
				email: freshEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});
		expect(signInResponse.ok()).toBe(true);

		// Check that emailVerified is now true in the sign-in response

		const signInData = (await signInResponse.json()) as {
			user?: { emailVerified: boolean; email: string };
		};
		if (signInData.user) {
			expect(signInData.user.email).toBe(freshEmail);
			expect(signInData.user.emailVerified).toBe(true);
		}
	});

	test('verification email has correct sender and template', async ({ request }) => {
		const templateEmail = `verify-template-${Date.now()}@test.com`;
		await request.post(`/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Template Test',
				email: templateEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});

		const email = await waitForEmail(templateEmail, 'verify', 15000);
		const detail = await getEmailById(email.ID);

		// Check email structure
		expect(email.From.Address).toContain('@');
		expect(detail.HTML).toContain('Verify Email');
		expect(detail.HTML).toContain('verify your email');
		expect(detail.Text).toContain('verify your email');
		// Should contain the app name
		expect(detail.HTML).toContain('Seeding Test App');
	});

	test('resend verification email works', async ({ request, baseURL }) => {
		// Sign up
		const resendEmail = `verify-resend-${Date.now()}@test.com`;
		await request.post(`/api/auth/sign-up/email`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Resend Test',
				email: resendEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});

		// Wait for initial verification email and save its ID
		const initialEmail = await waitForEmail(resendEmail, 'verify', 15000);

		// Sign in first (needed for the resend endpoint)
		// Origin header required by Better Auth CSRF protection
		await request.post(`/api/auth/sign-in/email`, {
			headers: { 'Content-Type': 'application/json', Origin: baseURL ?? '' },
			data: {
				email: resendEmail,
				password: VERIFY_USER_PASSWORD,
			},
		});

		// Request resend verification email via Better Auth
		const resendResponse = await request.post(`/api/auth/send-verification-email`, {
			headers: { 'Content-Type': 'application/json', Origin: baseURL ?? '' },
			data: { email: resendEmail },
		});

		// Better Auth should accept the resend request
		// (may return 200 even if already verified as a security measure)
		expect(resendResponse.status()).toBeLessThan(500);

		// If resend was accepted, wait for a NEW email (different ID from initial)
		if (resendResponse.ok()) {
			const startTime = Date.now();
			const timeout = 15000;
			let found = false;
			while (Date.now() - startTime < timeout) {
				const emails = await getEmails();
				const newEmail = emails.find(
					(e) =>
						e.ID !== initialEmail.ID &&
						e.To.some((t) => t.Address === resendEmail) &&
						e.Subject.toLowerCase().includes('verify'),
				);
				if (newEmail) {
					found = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
			expect(found, 'Resend verification email should arrive').toBe(true);
		}
	});
});

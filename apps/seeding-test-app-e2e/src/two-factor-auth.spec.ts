import { test, expect } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Two-Factor Authentication E2E Tests
 *
 * Tests the 2FA (TOTP) flow:
 * - Enable 2FA returns TOTP URI and backup codes
 * - Verify TOTP code
 * - Disable 2FA
 *
 * Uses a dedicated test user to avoid interfering with other tests.
 * All tests share a single authenticated API context created in beforeAll.
 */

// Unique test user for 2FA tests
const TFA_USER_EMAIL = `tfa-test-${Date.now()}@test.com`;
const TFA_USER_PASSWORD = 'TfaTest123!';
const TFA_USER_NAME = '2FA Test User';

// Skip: 2FA feature not yet fully integrated into admin UI
test.describe.skip('Two-Factor Authentication', () => {
	let apiContext: APIRequestContext;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		// Create a fresh user for 2FA tests using a persistent API context
		apiContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: {
				Origin: workerBaseURL,
			},
		});

		const signupResponse = await apiContext.post('/api/auth/sign-up/email', {
			data: {
				name: TFA_USER_NAME,
				email: TFA_USER_EMAIL,
				password: TFA_USER_PASSWORD,
			},
		});
		expect(signupResponse.ok()).toBe(true);

		// Sign in - cookies are automatically stored in apiContext
		const signInResponse = await apiContext.post('/api/auth/sign-in/email', {
			data: {
				email: TFA_USER_EMAIL,
				password: TFA_USER_PASSWORD,
			},
		});
		expect(signInResponse.ok()).toBe(true);
	});

	test.afterAll(async () => {
		await apiContext?.dispose();
	});

	test('enable 2FA returns TOTP URI and backup codes', async () => {
		const response = await apiContext.post('/api/auth/two-factor/enable', {
			data: {
				password: TFA_USER_PASSWORD,
			},
		});

		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			totpURI?: string;
			backupCodes?: string[];
			secret?: string;
		};

		// Should return a TOTP URI (otpauth://totp/...) for QR code generation
		expect(data.totpURI).toBeDefined();
		expect(data.totpURI).toContain('otpauth://totp/');

		// Should return backup codes
		expect(data.backupCodes).toBeDefined();
		expect(Array.isArray(data.backupCodes)).toBe(true);
		if (data.backupCodes) {
			expect(data.backupCodes.length).toBeGreaterThan(0);
		}
	});

	test('enable 2FA requires password', async () => {
		const response = await apiContext.post('/api/auth/two-factor/enable', {
			data: {},
		});

		// Should fail without password
		expect(response.ok()).toBe(false);
	});

	test('enable 2FA rejects wrong password', async () => {
		const response = await apiContext.post('/api/auth/two-factor/enable', {
			data: {
				password: 'WrongPassword123!',
			},
		});

		expect(response.ok()).toBe(false);
	});

	test('verify TOTP rejects invalid code', async () => {
		const response = await apiContext.post('/api/auth/two-factor/verify-totp', {
			data: {
				code: '000000',
			},
		});

		// Invalid TOTP code should be rejected
		expect(response.ok()).toBe(false);
	});

	test('disable 2FA endpoint exists and requires password', async () => {
		const response = await apiContext.post('/api/auth/two-factor/disable', {
			data: {},
		});

		// Should fail without password
		expect(response.ok()).toBe(false);
	});
});

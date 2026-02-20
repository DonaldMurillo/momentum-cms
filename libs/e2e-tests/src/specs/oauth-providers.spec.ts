import { test, expect } from '../fixtures';

/**
 * OAuth Providers E2E Tests
 *
 * Tests the OAuth provider infrastructure:
 * - Provider discovery endpoint (/api/auth/providers)
 * - Login page OAuth button rendering
 *
 * Note: Full OAuth flow cannot be E2E tested without real provider credentials.
 * These tests verify the configuration and UI wiring.
 */

test.describe('OAuth Provider Infrastructure', { tag: ['@auth', '@api'] }, () => {
	test('GET /api/auth/providers returns provider list', async ({ request }) => {
		const response = await request.get(`/api/auth/providers`);
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { providers: string[] };
		expect(data).toHaveProperty('providers');
		expect(Array.isArray(data.providers)).toBe(true);
	});

	test('providers endpoint returns empty array when no OAuth configured', async ({ request }) => {
		// The example-config does not configure any OAuth providers,
		// so the endpoint should return an empty array
		const response = await request.get(`/api/auth/providers`);
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { providers: string[] };
		expect(data.providers).toEqual([]);
	});

	test('login page renders without OAuth buttons when no providers configured', async ({
		page,
	}) => {
		await page.goto(`/admin/login`);
		await page.waitForLoadState('domcontentloaded');

		// Sign In form should be present
		await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

		// Email and password fields should be present
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();

		// OAuth buttons should NOT be present (no providers configured)
		await expect(page.getByText('Or continue with')).not.toBeVisible();
		await expect(page.locator('[data-provider="google"]')).not.toBeVisible();
		await expect(page.locator('[data-provider="github"]')).not.toBeVisible();
	});

	test('provider endpoint is public and does not require authentication', async ({ request }) => {
		// Ensure no auth cookies are sent
		const response = await request.get(`/api/auth/providers`, {
			headers: { Cookie: '' },
		});
		expect(response.ok()).toBe(true);
		expect(response.status()).toBe(200);
	});

	test('social sign-in endpoint exists but requires provider config', async ({
		request,
		baseURL,
	}) => {
		// Attempt social sign-in without configured provider should fail gracefully
		const response = await request.post(`/api/auth/sign-in/social`, {
			headers: {
				'Content-Type': 'application/json',
				Origin: baseURL ?? '',
			},
			data: {
				provider: 'google',
				callbackURL: '/admin',
			},
		});

		// Better Auth should return an error since no Google provider is configured
		// Expected to be a 4xx or specific error response
		expect(response.status()).toBeGreaterThanOrEqual(400);
	});
});

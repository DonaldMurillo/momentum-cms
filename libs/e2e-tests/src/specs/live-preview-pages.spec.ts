import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Live Preview E2E Tests
 *
 * Verifies that the live preview content appears when editing a page
 * and that the preview renders the actual page content via in-memory
 * Angular component rendering (NgComponentOutlet).
 *
 * The Pages collection has admin.preview configured, which triggers
 * the split layout in CollectionEditPage.
 */

/** Helper: sign in and get the home page ID */
async function getHomePageId(request: APIRequestContext): Promise<string> {
	// Sign in first
	await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: {
			email: TEST_CREDENTIALS.email,
			password: TEST_CREDENTIALS.password,
		},
	});

	const response = await request.get('/api/pages?where[slug][equals]=home&limit=1');
	expect(response.ok()).toBe(true);
	const body = (await response.json()) as { docs: Array<{ id: string }> };
	expect(body.docs.length).toBeGreaterThan(0);
	return body.docs[0].id;
}

test.describe('Live Preview', { tag: ['@admin', '@blocks'] }, () => {
	test('preview content appears when editing a page', async ({
		authenticatedPage: page,
		request,
	}) => {
		const pageId = await getHomePageId(request);

		await page.goto(`/admin/collections/pages/${pageId}/edit`);

		// The split layout should appear
		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		// The preview content container should exist
		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible();
	});

	test('preview content renders page content', async ({ authenticatedPage: page, request }) => {
		const pageId = await getHomePageId(request);

		await page.goto(`/admin/collections/pages/${pageId}/edit`);

		// Wait for the preview layout
		await expect(page.locator('[data-testid="preview-layout"]')).toBeVisible({ timeout: 15000 });

		// Access the preview content directly in the DOM
		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible();

		// The preview should eventually render the page content
		await expect(previewContent.locator('[data-testid="hero-heading"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(previewContent.locator('[data-testid="hero-heading"]')).toContainText(
			'Welcome to Our Site',
		);
	});
});

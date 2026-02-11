import { test, expect, TEST_CREDENTIALS } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Block Analytics Fields E2E Tests
 *
 * Verifies that the analytics plugin injects _analytics group fields
 * (Track Impressions, Track Hover checkboxes) into every block definition,
 * and that these fields are visible and functional in the admin editing UI.
 * The _analytics group renders as a collapsible accordion.
 */

interface PageDoc {
	id: string;
	title: string;
	slug: string;
	content?: Array<{
		blockType: string;
		_analytics?: { trackImpressions?: boolean; trackHover?: boolean };
		[key: string]: unknown;
	}>;
}

let testPageCounter = 0;

async function getPageByTitle(request: APIRequestContext, title: string): Promise<PageDoc> {
	const response = await request.get('/api/pages?limit=50');
	expect(response.ok()).toBe(true);
	const data = (await response.json()) as { docs: PageDoc[] };
	const page = data.docs.find((d) => d.title === title);
	expect(page, `Page "${title}" should exist`).toBeTruthy();
	return page!;
}

async function createTestPage(
	request: APIRequestContext,
	blocks: Array<{ blockType: string; [key: string]: unknown }>,
	title?: string,
): Promise<PageDoc> {
	const ts = Date.now();
	testPageCounter++;
	const uniqueSlug = `ba-test-${ts}-${testPageCounter}-${Math.random().toString(36).slice(2, 8)}`;
	const pageTitle = title ?? `Block Analytics Test ${ts}-${testPageCounter}`;

	const response = await request.post('/api/pages', {
		headers: { 'Content-Type': 'application/json' },
		data: { title: pageTitle, slug: uniqueSlug, content: blocks },
	});
	expect(response.ok(), 'Test page creation must succeed').toBe(true);
	const body = (await response.json()) as { doc: PageDoc };
	return body.doc;
}

test.describe('Block Analytics Fields', { tag: ['@analytics', '@crud'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	// ── API Tests ──

	test('blocks without explicit _analytics get defaults normalized on edit+save', async ({
		authenticatedPage,
		request,
	}) => {
		// Create a page with blocks that omit _analytics
		const page = await createTestPage(request, [
			{ blockType: 'hero', heading: 'Default Test Hero' },
		]);

		// API response should NOT have _analytics (server doesn't auto-populate group defaults)
		const getResponse = await request.get(`/api/pages/${page.id}`);
		expect(getResponse.ok()).toBe(true);
		const getBody = (await getResponse.json()) as { doc: PageDoc };
		expect(getBody.doc.content?.[0]?._analytics).toBeUndefined();

		// Open in edit UI — the editor normalizes blocks with definition defaults
		await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const blockWrapper = authenticatedPage.locator('[data-testid="block-wrapper"]');
		await expect(blockWrapper).toHaveCount(1, { timeout: 10000 });

		// Expand the collapsible Analytics accordion to reveal checkboxes
		const analyticsAccordion = blockWrapper.getByText('Analytics', { exact: true });
		await expect(analyticsAccordion).toBeVisible();
		await analyticsAccordion.click();

		// The _analytics checkboxes should be visible and default to unchecked
		const trackImpressions = authenticatedPage.getByRole('checkbox', {
			name: /Track Impressions/i,
		});
		await expect(trackImpressions).toBeVisible();
		await expect(trackImpressions).toHaveAttribute('aria-checked', 'false');

		// Save without changing analytics — this persists the normalized defaults
		const saveButton = authenticatedPage.getByRole('button', { name: /Save Changes/i });
		await saveButton.click();
		await expect(authenticatedPage.getByText(/saved|updated/i).first()).toBeVisible({
			timeout: 10000,
		});

		// Now the API should have _analytics with false defaults (normalized by UI on save)
		const getAfterSave = await request.get(`/api/pages/${page.id}`);
		expect(getAfterSave.ok()).toBe(true);
		const afterSave = (await getAfterSave.json()) as { doc: PageDoc };
		expect(afterSave.doc.content?.[0]?._analytics).toBeDefined();
		expect(afterSave.doc.content?.[0]?._analytics?.trackImpressions).toBe(false);
		expect(afterSave.doc.content?.[0]?._analytics?.trackHover).toBe(false);

		// Clean up
		const del = await request.delete(`/api/pages/${page.id}`);
		expect(del.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('analytics fields persist through create with explicit values', async ({ request }) => {
		const page = await createTestPage(request, [
			{
				blockType: 'hero',
				heading: 'Analytics Test Hero',
				_analytics: { trackImpressions: true, trackHover: true },
			},
			{
				blockType: 'textBlock',
				body: 'Some content',
				_analytics: { trackImpressions: false, trackHover: true },
			},
		]);

		// Verify create response
		expect(page.content?.[0]?._analytics?.trackImpressions).toBe(true);
		expect(page.content?.[0]?._analytics?.trackHover).toBe(true);
		expect(page.content?.[1]?._analytics?.trackImpressions).toBe(false);
		expect(page.content?.[1]?._analytics?.trackHover).toBe(true);

		// Verify persistence via GET
		const getResponse = await request.get(`/api/pages/${page.id}`);
		expect(getResponse.ok()).toBe(true);
		const getBody = (await getResponse.json()) as { doc: PageDoc };
		expect(getBody.doc.content?.[0]?._analytics?.trackImpressions).toBe(true);
		expect(getBody.doc.content?.[0]?._analytics?.trackHover).toBe(true);
		expect(getBody.doc.content?.[1]?._analytics?.trackHover).toBe(true);

		// Clean up
		const del = await request.delete(`/api/pages/${page.id}`);
		expect(del.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('analytics fields can be updated via PATCH', async ({ request }) => {
		const page = await createTestPage(request, [
			{
				blockType: 'hero',
				heading: 'Update Test',
				_analytics: { trackImpressions: true, trackHover: false },
			},
		]);

		// Update: toggle values
		const updateResponse = await request.patch(`/api/pages/${page.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				content: [
					{
						blockType: 'hero',
						heading: 'Update Test',
						_analytics: { trackImpressions: false, trackHover: true },
					},
				],
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify update
		const getResponse = await request.get(`/api/pages/${page.id}`);
		expect(getResponse.ok()).toBe(true);
		const getBody = (await getResponse.json()) as { doc: PageDoc };
		expect(getBody.doc.content?.[0]?._analytics?.trackImpressions).toBe(false);
		expect(getBody.doc.content?.[0]?._analytics?.trackHover).toBe(true);

		// Clean up
		const del = await request.delete(`/api/pages/${page.id}`);
		expect(del.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	// ── UI Tests ──

	test('analytics group visible in block editing form as collapsible', async ({
		authenticatedPage,
		request,
	}) => {
		const homePage = await getPageByTitle(request, 'Home Page');
		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the visual block editor to load
		const blockWrappers = authenticatedPage.locator('[data-testid="block-wrapper"]');
		await expect(blockWrappers).toHaveCount(3, { timeout: 10000 });

		// Each block should contain an "Analytics" accordion trigger
		for (let i = 0; i < 3; i++) {
			const wrapper = blockWrappers.nth(i);
			const fieldsArea = wrapper.locator('[data-testid="block-fields"]');
			await expect(fieldsArea).toBeVisible();

			// The group field renders as a collapsible accordion with "Analytics" label
			const analyticsLabel = fieldsArea.getByText('Analytics', { exact: true });
			await expect(analyticsLabel).toBeVisible();
		}

		// Expand the first block's analytics accordion to verify checkboxes
		const firstWrapper = blockWrappers.nth(0);
		const firstAnalytics = firstWrapper
			.locator('[data-testid="block-fields"]')
			.getByText('Analytics', { exact: true });
		await firstAnalytics.click();

		// After expanding, checkboxes should be visible within the first block
		const trackImpressionsCheckbox = firstWrapper.getByRole('checkbox', {
			name: /Track Impressions/i,
		});
		const trackHoverCheckbox = firstWrapper.getByRole('checkbox', {
			name: /Track Hover/i,
		});

		await expect(trackImpressionsCheckbox).toBeVisible();
		await expect(trackHoverCheckbox).toBeVisible();
	});

	test('toggle analytics checkboxes and save persists values', async ({
		authenticatedPage,
		request,
	}) => {
		// Create a test page with one block
		const page = await createTestPage(request, [
			{ blockType: 'textBlock', heading: 'Toggle Test', body: 'Test content' },
		]);

		await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for block to render
		const blockWrapper = authenticatedPage.locator('[data-testid="block-wrapper"]');
		await expect(blockWrapper).toHaveCount(1, { timeout: 10000 });

		// Expand the collapsible Analytics accordion
		const analyticsLabel = blockWrapper.getByText('Analytics', { exact: true });
		await expect(analyticsLabel).toBeVisible();
		await analyticsLabel.click();

		// Find and toggle the Track Impressions checkbox
		const trackImpressions = authenticatedPage.getByRole('checkbox', {
			name: /Track Impressions/i,
		});
		await expect(trackImpressions).toBeVisible();

		// Default should be unchecked
		await expect(trackImpressions).toHaveAttribute('aria-checked', 'false');

		// Toggle it on
		await trackImpressions.click();
		await expect(trackImpressions).toHaveAttribute('aria-checked', 'true');

		// Save
		const saveButton = authenticatedPage.getByRole('button', { name: /Save Changes/i });
		await saveButton.click();

		// Wait for save to complete (toast or URL change)
		await expect(authenticatedPage.getByText(/saved|updated/i).first()).toBeVisible({
			timeout: 10000,
		});

		// Verify via API
		const getResponse = await request.get(`/api/pages/${page.id}`);
		expect(getResponse.ok()).toBe(true);
		const getBody = (await getResponse.json()) as { doc: PageDoc };
		expect(getBody.doc.content?.[0]?._analytics?.trackImpressions).toBe(true);
		expect(getBody.doc.content?.[0]?._analytics?.trackHover).toBe(false);

		// Clean up
		const del = await request.delete(`/api/pages/${page.id}`);
		expect(del.ok(), 'Cleanup delete must succeed').toBe(true);
	});

	test('new block added via UI includes analytics group', async ({
		authenticatedPage,
		request,
	}) => {
		// Create page with no blocks
		const page = await createTestPage(request, []);

		await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The visual editor empty state shows a block inserter
		const inserter = authenticatedPage.locator('[data-testid="block-inserter"]');
		await expect(inserter).toBeVisible({ timeout: 10000 });

		// Click the inserter "+" button to open the command palette
		await inserter.getByRole('button').click();

		// Select "Text Block" from the command palette options
		const textBlockOption = authenticatedPage.getByRole('option', { name: /Text Block/i });
		await expect(textBlockOption).toBeVisible({ timeout: 5000 });
		await textBlockOption.click();

		// Wait for the new block to appear
		const blockWrapper = authenticatedPage.locator('[data-testid="block-wrapper"]');
		await expect(blockWrapper).toHaveCount(1, { timeout: 5000 });

		// The new block should include the Analytics collapsible accordion
		const fieldsArea = blockWrapper.locator('[data-testid="block-fields"]');
		const analyticsLabel = fieldsArea.getByText('Analytics', { exact: true });
		await expect(analyticsLabel).toBeVisible();

		// Expand to reveal checkboxes
		await analyticsLabel.click();

		const trackImpressions = blockWrapper.getByRole('checkbox', {
			name: /Track Impressions/i,
		});
		const trackHover = blockWrapper.getByRole('checkbox', {
			name: /Track Hover/i,
		});
		await expect(trackImpressions).toBeVisible();
		await expect(trackHover).toBeVisible();

		// Clean up
		const del = await request.delete(`/api/pages/${page.id}`);
		expect(del.ok(), 'Cleanup delete must succeed').toBe(true);
	});
});

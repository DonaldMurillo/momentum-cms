import { test, expect, TEST_AUTHOR3_CREDENTIALS } from '../fixtures';

/**
 * Blocks collapse/expand E2E tests.
 * Verifies the standard BlocksFieldRenderer collapse/expand toggle works in the admin UI.
 *
 * Uses the Events collection which has a standard `blocks('sections')` field
 * (no visual editor), with 'speaker' and 'schedule' block types.
 */
test.describe('Blocks collapse/expand', { tag: ['@admin', '@blocks'] }, () => {
	let eventId: string;

	/** Sign in helper for page context */
	async function signInPage(page: import('@playwright/test').Page): Promise<void> {
		await page.goto('/admin/login');
		await page.waitForLoadState('domcontentloaded');
		const res = await page.request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});
		expect(res.ok()).toBe(true);
	}

	test.beforeAll(async ({ request }) => {
		// Sign in
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author3 sign-in must succeed').toBe(true);

		// Create an event with blocks
		const createResponse = await request.post('/api/events', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Collapse Test Event',
				description: 'Event for collapse/expand E2E testing',
				location: 'Test City',
				sections: [
					{ blockType: 'speaker', name: 'Alice Johnson', topic: 'Angular Signals' },
					{ blockType: 'schedule', time: '10:00 AM', activity: 'Opening Keynote' },
					{ blockType: 'speaker', name: 'Bob Smith', topic: 'Headless CMS' },
				],
			},
		});
		expect(createResponse.status(), 'Event create should return 201').toBe(201);

		const created = (await createResponse.json()) as { doc: { id: string } };
		eventId = created.doc.id;
	});

	test.afterAll(async ({ request }) => {
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});
		if (eventId) {
			await request.delete(`/api/events/${eventId}`);
		}
	});

	test('all blocks start expanded with fields visible', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Wait for blocks to render
		const blockFields = page.locator('[data-testid="block-fields"]');
		await expect(blockFields.first()).toBeVisible({ timeout: 15000 });

		// All 3 blocks should have visible field sections
		await expect(blockFields).toHaveCount(3);

		// Verify actual field values are rendered in the first speaker block
		const firstBlockInputs = blockFields.first().locator('input');
		await expect(firstBlockInputs.first()).toHaveValue('Alice Johnson');

		// All collapse toggles should have aria-expanded="true"
		const toggles = page.locator('[data-testid="block-collapse-toggle"]');
		await expect(toggles).toHaveCount(3);
		for (let i = 0; i < 3; i++) {
			await expect(toggles.nth(i)).toHaveAttribute('aria-expanded', 'true');
		}
	});

	test('clicking collapse toggle hides block fields and content', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const blockFields = page.locator('[data-testid="block-fields"]');
		const toggles = page.locator('[data-testid="block-collapse-toggle"]');
		await expect(blockFields.first()).toBeVisible({ timeout: 15000 });
		await expect(blockFields).toHaveCount(3);

		// Verify first speaker's name input is visible before collapse
		// Use nth(0) on blockFields to get a snapshot-like reference for block 0
		const firstBlockFields = blockFields.nth(0);
		await expect(firstBlockFields.locator('input').first()).toHaveValue('Alice Johnson');

		// Collapse the first block (toggle 0)
		await toggles.nth(0).click();

		// The @if removes the block-fields div entirely — only 2 remain
		await expect(blockFields).toHaveCount(2);

		// First toggle should now indicate collapsed state
		await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
		await expect(toggles.nth(0)).toHaveAttribute('aria-label', 'Expand block');

		// The remaining visible block-fields are blocks 1 (schedule) and 2 (speaker).
		// blockFields.nth(0) now points to schedule (block index 1).
		await expect(blockFields.nth(0).locator('input').first()).toHaveValue('10:00 AM');

		// Other toggles remain expanded
		await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
		await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'true');
	});

	test('clicking collapsed toggle re-expands block fields', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const blockFields = page.locator('[data-testid="block-fields"]');
		await expect(blockFields.first()).toBeVisible({ timeout: 15000 });

		const toggles = page.locator('[data-testid="block-collapse-toggle"]');

		// Collapse second block
		await toggles.nth(1).click();
		await expect(blockFields).toHaveCount(2);
		await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');

		// Re-expand second block
		await toggles.nth(1).click();
		await expect(blockFields).toHaveCount(3);
		await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
		await expect(toggles.nth(1)).toHaveAttribute('aria-label', 'Collapse block');
	});

	test('multiple blocks can be collapsed independently', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const blockFields = page.locator('[data-testid="block-fields"]');
		await expect(blockFields.first()).toBeVisible({ timeout: 15000 });

		const toggles = page.locator('[data-testid="block-collapse-toggle"]');

		// Collapse first and third blocks
		await toggles.first().click();
		await toggles.nth(2).click();

		// Only second block's fields should be visible
		await expect(blockFields).toHaveCount(1);

		// Verify toggle states
		await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false');
		await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
		await expect(toggles.nth(2)).toHaveAttribute('aria-expanded', 'false');
	});
});

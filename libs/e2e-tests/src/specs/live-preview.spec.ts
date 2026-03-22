import { test, expect, TEST_AUTHOR3_CREDENTIALS } from '../fixtures';

/**
 * Live Preview E2E tests.
 * Verifies the live preview panel renders real HTML content via in-memory
 * Angular component rendering (NgComponentOutlet) instead of iframes.
 *
 * Uses the Events collection which has `admin.preview: true` enabled.
 */
test.describe('Live Preview', { tag: ['@admin', '@blocks'] }, () => {
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

		// Create an event
		const createResponse = await request.post('/api/events', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'LP-Preview Test Event',
				description: 'Event for live preview testing',
				location: 'Preview City',
			},
		});
		expect(createResponse.status(), 'Event create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};
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

	test('preview content loads and renders styled HTML with document data', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Preview layout should appear (split pane)
		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		// Preview content container should exist
		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible({ timeout: 10000 });

		// The preview should render the title as an <h1> element directly in the DOM
		const h1 = previewContent.locator('h1');
		await expect(h1).toContainText('LP-Preview Test Event', { timeout: 15000 });

		// Verify field values are rendered
		await expect(previewContent).toContainText('Preview City');
	});

	test('device size toggle changes preview container width', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible({ timeout: 10000 });

		// Switch to tablet — retry click for hydration timing
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-tablet"]').click();
					return previewContent.evaluate((el) => el.style.width);
				},
				{ timeout: 5000 },
			)
			.toBe('768px');

		// Switch to mobile
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-mobile"]').click();
					return previewContent.evaluate((el) => el.style.width);
				},
				{ timeout: 5000 },
			)
			.toBe('375px');

		// Switch back to desktop
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-desktop"]').click();
					return previewContent.evaluate((el) => el.style.width);
				},
				{ timeout: 5000 },
			)
			.toBe('100%');
	});

	test('preview does NOT appear for collections without preview config', async ({ page }) => {
		await signInPage(page);

		// Navigate to categories create page (no preview configured)
		await page.goto('/admin/collections/categories/create');
		await page.waitForLoadState('domcontentloaded');

		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).not.toBeVisible({ timeout: 5000 });

		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeHidden();
	});

	test('preview content updates after editing a field', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible({ timeout: 15000 });

		// Wait for preview content to fully render
		await expect(previewContent.locator('h1')).toContainText('LP-Preview Test Event', {
			timeout: 15000,
		});

		// Edit the location field using pressSequentially to trigger signal form change detection
		const locationInput = page.getByLabel('Location');
		await expect(locationInput).toBeVisible({ timeout: 10000 });
		await locationInput.click();
		await page.keyboard.press('ControlOrMeta+a');
		await locationInput.pressSequentially('Updated Preview City', { delay: 20 });

		// Wait for the preview content to reflect the updated location value
		await expect
			.poll(
				async () => {
					try {
						return await previewContent.textContent();
					} catch {
						return '';
					}
				},
				{ timeout: 15000, message: 'Preview should contain updated location value' },
			)
			.toContain('Updated Preview City');
	});

	test('refresh button reloads preview content', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const previewContent = page.locator('[data-testid="preview-content"]');
		await expect(previewContent).toBeVisible({ timeout: 15000 });

		// Wait for content to render
		await expect(previewContent.locator('h1')).toContainText('LP-Preview Test Event', {
			timeout: 15000,
		});

		// Click refresh
		const refreshButton = page.locator('[data-testid="preview-refresh"]');
		await expect(refreshButton).toBeVisible();
		await refreshButton.click();

		// Wait for preview content to still be visible after refresh
		await expect(previewContent).toBeVisible({ timeout: 5000 });

		// Verify the preview still contains document data after refresh
		await expect(previewContent.locator('h1')).toContainText('LP-Preview Test Event', {
			timeout: 15000,
		});
	});
});

test.describe('Preview Endpoint Auth', { tag: ['@api', '@security'] }, () => {
	test('GET preview should return 401 for unauthenticated requests', async ({ request }) => {
		const response = await request.get('/api/events/any-id/preview');
		expect(response.status()).toBe(401);
	});

	test('POST preview should return 401 for unauthenticated requests', async ({ request }) => {
		const response = await request.post('/api/events/any-id/preview', {
			data: { data: { title: 'injected' } },
		});
		expect(response.status()).toBe(401);
	});
});

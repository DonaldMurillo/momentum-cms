import { test, expect, TEST_AUTHOR3_CREDENTIALS } from './fixtures';

/**
 * Live Preview E2E tests.
 * Verifies the live preview panel renders real HTML content, postMessage delivers
 * field values, and the iframe URL responds correctly.
 *
 * Uses the Events collection which has `admin.preview: true` enabled.
 */
test.describe('Live Preview', () => {
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

	test('preview iframe loads and renders styled HTML with document data', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// Preview layout should appear (split pane)
		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		// Preview iframe should exist
		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 10000 });

		// Verify iframe src points to the built-in preview endpoint
		await expect(iframe).toHaveAttribute(
			'src',
			new RegExp(`${eventId}.*\\/preview|\\/preview.*${eventId}`),
		);

		// Access the iframe's content frame and verify it rendered HTML
		const iframeHandle = await iframe.elementHandle();
		const frame = await iframeHandle?.contentFrame();
		expect(frame).toBeTruthy();

		await frame!.waitForLoadState('domcontentloaded');

		// The preview should render the title as an <h1> element
		const h1Text = await frame!.evaluate(() => {
			const h1 = document.querySelector('h1');
			return h1?.textContent ?? '';
		});
		expect(h1Text).toContain('LP-Preview Test Event');

		// Verify field labels are rendered
		const bodyText = await frame!.evaluate(() => document.body.innerText);
		expect(bodyText).toContain('Preview City');
	});

	test('device size toggle changes iframe width', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const previewLayout = page.locator('[data-testid="preview-layout"]');
		await expect(previewLayout).toBeVisible({ timeout: 15000 });

		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 10000 });

		// Switch to tablet — retry click for hydration timing
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-tablet"]').click();
					return iframe.evaluate((el) => el.style.width);
				},
				{ timeout: 5000 },
			)
			.toBe('768px');

		// Switch to mobile
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-mobile"]').click();
					return iframe.evaluate((el) => el.style.width);
				},
				{ timeout: 5000 },
			)
			.toBe('375px');

		// Switch back to desktop
		await expect
			.poll(
				async () => {
					await page.locator('[data-testid="device-desktop"]').click();
					return iframe.evaluate((el) => el.style.width);
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

		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).not.toBeVisible();
	});

	test('postMessage payload contains correct field values after edit', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 15000 });

		// Wait for iframe content to fully render using frameLocator (resilient to navigation)
		const iframeLocator = page.frameLocator('[data-testid="preview-iframe"]');
		await expect(iframeLocator.locator('h1')).toContainText('LP-Preview Test Event', {
			timeout: 15000,
		});

		// Helper to get a fresh frame reference (handles stale frames after iframe navigation)
		const getFrame = async (): Promise<import('@playwright/test').Frame> => {
			const handle = await iframe.elementHandle();
			const f = await handle?.contentFrame();
			if (!f) throw new Error('No iframe content frame');
			return f;
		};

		// Set up postMessage listener in the iframe.
		// Uses expect.poll which retries on thrown errors (e.g. if frame navigates during setup).
		// The listener setup is idempotent via the _previewListenerReady flag.
		await expect
			.poll(
				async () => {
					const f = await getFrame();
					return f.evaluate(() => {
						if (!(window as unknown as Record<string, boolean>)['_previewListenerReady']) {
							(window as unknown as Record<string, unknown>)['_previewMessages'] = [];
							window.addEventListener('message', (event: MessageEvent) => {
								if (event.data?.type === 'momentum-preview-update') {
									(
										(window as unknown as Record<string, unknown>)['_previewMessages'] as unknown[]
									).push(event.data);
								}
							});
							(window as unknown as Record<string, boolean>)['_previewListenerReady'] = true;
						}
						return true;
					});
				},
				{ timeout: 10000, message: 'Should set up postMessage listener in iframe' },
			)
			.toBe(true);

		// Edit the location field using pressSequentially to trigger signal form change detection
		const locationInput = page.getByLabel('Location');
		await expect(locationInput).toBeVisible({ timeout: 10000 });
		await locationInput.click();
		await page.keyboard.press('Meta+a');
		await locationInput.pressSequentially('Updated Preview City', { delay: 20 });

		// Wait for debounced postMessage containing the UPDATED location value.
		// The admin component may send initial messages with original values before the
		// edit propagates, so poll for the last message to contain the edited value.
		await expect
			.poll(
				async () => {
					const f = await getFrame();
					return f.evaluate(() => {
						const msgs = (window as unknown as Record<string, unknown>)[
							'_previewMessages'
						] as Array<{ data: Record<string, unknown> }>;
						if (msgs.length === 0) return null;
						return msgs[msgs.length - 1].data?.['location'] ?? null;
					});
				},
				{ timeout: 10000 },
			)
			.toBe('Updated Preview City');

		// Verify the full message structure
		const frame = await getFrame();
		const lastMessage = await frame.evaluate(() => {
			const messages = (window as unknown as Record<string, unknown>)['_previewMessages'] as Array<{
				type: string;
				data: Record<string, unknown>;
			}>;
			return messages.length > 0 ? messages[messages.length - 1] : null;
		});

		expect(lastMessage).toBeTruthy();
		expect(lastMessage!.type).toBe('momentum-preview-update');
		expect(lastMessage!.data['title']).toBe('LP-Preview Test Event');
	});

	test('refresh button reloads preview iframe', async ({ page }) => {
		await signInPage(page);
		await page.goto(`/admin/collections/events/${eventId}/edit`);
		await page.waitForLoadState('domcontentloaded');

		const iframe = page.locator('[data-testid="preview-iframe"]');
		await expect(iframe).toBeVisible({ timeout: 15000 });

		// Verify the original src is present
		await expect(iframe).toHaveAttribute('src', /.+/);

		// Click refresh
		const refreshButton = page.locator('[data-testid="preview-refresh"]');
		await expect(refreshButton).toBeVisible();
		await refreshButton.click();

		// Wait for iframe to still be visible after refresh with correct src
		await expect(iframe).toBeVisible({ timeout: 5000 });
		await expect(iframe).toHaveAttribute('src', new RegExp(eventId));

		// Verify the iframe still contains document data after refresh
		const iframeHandle = await iframe.elementHandle();
		const frame = await iframeHandle?.contentFrame();
		if (frame) {
			await frame.waitForLoadState('domcontentloaded');
			const h1Text = await frame.evaluate(() => {
				const h1 = document.querySelector('h1');
				return h1?.textContent ?? '';
			});
			expect(h1Text).toContain('LP-Preview Test Event');
		}
	});
});

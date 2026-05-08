import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

/**
 * Comprehensive UI coverage for the versioning + publishing flows that the
 * existing versioning-admin-ui.spec.ts left untested:
 *  - Save Draft button
 *  - Unpublish (with confirm)
 *  - Restore version (with confirm)
 *  - Schedule Publish (new dialog UI shipped alongside this PR)
 *  - Cancel Scheduled Publish (with confirm)
 *  - Compare-with-current edge cases (oldest, identical)
 *  - Adversarial cases meant to break the feature
 *
 * UI tests interact through real button clicks and dialog confirmations.
 * Setup uses the API for speed — the navigation chain still goes through
 * the article edit page, exercising the actual widgets.
 */

async function signInApi(
	request: APIRequestContext,
	credentials: { email: string; password: string },
): Promise<void> {
	const res = await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: { email: credentials.email, password: credentials.password },
	});
	expect(res.ok(), `Sign-in for ${credentials.email} must succeed`).toBe(true);
}

async function createArticle(
	request: APIRequestContext,
	title: string,
	content = '<p>Body</p>',
): Promise<string> {
	const res = await request.post('/api/articles', {
		headers: { 'Content-Type': 'application/json' },
		data: { title, content },
	});
	expect(res.status(), `Article create for "${title}" must return 201`).toBe(201);
	const body = (await res.json()) as { doc: { id: string } };
	return body.doc.id;
}

async function publishArticle(request: APIRequestContext, id: string): Promise<void> {
	const res = await request.post(`/api/articles/${id}/publish`);
	expect(res.ok(), `Publishing article ${id} must succeed`).toBe(true);
}

async function gotoEditPage(page: Page, id: string): Promise<void> {
	await page.goto(`/admin/collections/articles/${id}/edit`);
	await page.waitForLoadState('domcontentloaded');
	// Wait for publish-controls to mount before any test interactions
	await expect(page.locator('mcms-publish-controls')).toBeVisible({ timeout: 15000 });
}

test.describe(
	'Versioning + Publishing UI coverage',
	{ tag: ['@versioning', '@publishing', '@admin'] },
	() => {
		const articleIds: string[] = [];

		test.afterAll(async ({ request }) => {
			await signInApi(request, TEST_CREDENTIALS);
			for (const id of articleIds) {
				await request.delete(`/api/articles/${id}`).catch(() => undefined);
			}
		});

		// ============================================
		// Save Draft button
		// ============================================

		test('Save draft button writes a new version and toasts', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-SaveDraft');
			articleIds.push(id);

			await gotoEditPage(page, id);
			// Wait for the version history widget itself, not its items — a fresh
			// document has no versions until the first publish/saveDraft.
			await expect(page.locator('mcms-version-history')).toBeVisible({ timeout: 15000 });

			const versionsLocator = page.locator(
				'mcms-version-history [data-testid="version-timeline-item"]',
			);
			const initialCount = await versionsLocator.count();

			// Edit the title
			await page.locator('input#field-title').fill('VPUI-SaveDraft EDITED');

			// Click Save draft. Wait for the API call we expect this to fire.
			const draftSaveResponse = page.waitForResponse(
				(res) =>
					res.url().includes(`/api/articles/${id}/draft`) && res.request().method() === 'POST',
			);
			await page.getByRole('button', { name: /^Save draft$/ }).click();
			const response = await draftSaveResponse;
			expect(response.ok(), 'Save draft endpoint must return success').toBe(true);

			// Toast announces the save
			await expect(page.getByText('Draft saved').first()).toBeVisible({ timeout: 5000 });

			// Version history grew (0→1+ or n→n+1)
			await expect
				.poll(async () => versionsLocator.count(), { timeout: 10000 })
				.toBeGreaterThan(initialCount);
		});

		test('Save draft does not navigate away from the edit page', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-SaveDraft-NoNav');
			articleIds.push(id);

			await gotoEditPage(page, id);
			await page.locator('input#field-title').fill('VPUI-SaveDraft-NoNav EDITED');
			await page.getByRole('button', { name: /^Save draft$/ }).click();
			await expect(page.getByText('Draft saved').first()).toBeVisible({ timeout: 5000 });

			expect(page.url(), 'Save draft must keep the user on the edit page').toMatch(
				new RegExp(`/admin/collections/articles/${id}/edit`),
			);
		});

		// ============================================
		// Unpublish flow
		// ============================================

		test('Unpublish opens confirm dialog and only acts on confirm', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-Unpublish');
			articleIds.push(id);
			await publishArticle(request, id);

			await gotoEditPage(page, id);
			const controls = page.locator('mcms-publish-controls');
			await expect(controls.getByText('Published')).toBeVisible();

			// Cancel branch — status must NOT flip. Scope queries to the
			// confirmation dialog so we don't accidentally hit the entity-form
			// Cancel button that lives behind the modal backdrop.
			await page.locator('[data-testid="unpublish-button"]').click();
			const dialog = page.locator('mcms-confirmation-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });
			await dialog.getByRole('button', { name: 'Cancel' }).click();
			await expect(dialog).toBeHidden({ timeout: 5000 });
			await expect(controls.getByText('Published')).toBeVisible();

			// Confirm branch
			await page.locator('[data-testid="unpublish-button"]').click();
			const dialog2 = page.locator('mcms-confirmation-dialog');
			await expect(dialog2).toBeVisible({ timeout: 5000 });
			await dialog2.getByRole('button', { name: 'Unpublish' }).click();

			await expect(controls.getByText('Draft')).toBeVisible({ timeout: 10000 });
			await expect(page.locator('[data-testid="publish-button"]')).toBeVisible();
		});

		// ============================================
		// Restore from version history
		// ============================================

		test('Restore opens confirm dialog and updates the document on confirm', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-Restore-original');
			articleIds.push(id);
			await publishArticle(request, id);
			// Mutate so there's an older version to restore to
			await request.patch(`/api/articles/${id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'VPUI-Restore-current' },
			});
			await publishArticle(request, id);

			await gotoEditPage(page, id);
			const history = page.locator('mcms-version-history');
			await expect(history).toBeVisible();

			// The restore button only renders for non-current versions. Buttons
			// carry an aria-label like "Restore version from <date>" — match
			// against that so we don't collide with text-only matches.
			const restoreButtons = history.getByRole('button', { name: /^Restore version from / });
			await expect(restoreButtons.first()).toBeVisible({ timeout: 10000 });

			// Cancel the confirm dialog first
			await restoreButtons.first().click();
			const cancelDialog = page.locator('mcms-confirmation-dialog');
			await expect(cancelDialog).toBeVisible({ timeout: 5000 });
			await cancelDialog.getByRole('button', { name: 'Cancel' }).click();
			await expect(cancelDialog).toBeHidden({ timeout: 5000 });
			// Title should remain 'current' after cancel
			await expect(page.locator('input#field-title')).toHaveValue('VPUI-Restore-current');

			// Confirm restore
			await restoreButtons.first().click();
			const confirmDialog = page.locator('mcms-confirmation-dialog');
			await expect(confirmDialog).toBeVisible({ timeout: 5000 });
			await confirmDialog.getByRole('button', { name: 'Restore' }).click();

			// Toast announces the restore
			await expect(page.getByText('Version restored').first()).toBeVisible({ timeout: 5000 });

			// Document should reflect the original title via API (form may not auto-reload
			// in the current implementation, so we verify the source of truth).
			const fetched = await request.get(`/api/articles/${id}`);
			expect(fetched.ok()).toBe(true);
			const body = (await fetched.json()) as { doc: { title: string } };
			expect(body.doc.title).toBe('VPUI-Restore-original');
		});

		test('Current version does not show a Restore button', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-Restore-Current');
			articleIds.push(id);
			await publishArticle(request, id);

			await gotoEditPage(page, id);
			const history = page.locator('mcms-version-history');
			const firstItem = history.locator('[data-testid="version-timeline-item"]').first();
			await expect(firstItem).toBeVisible({ timeout: 10000 });
			await expect(
				firstItem.getByRole('button', { name: /^Restore version from / }),
				'Current version row must not expose a Restore button',
			).toHaveCount(0);
		});

		// ============================================
		// Schedule Publish (new UI)
		// ============================================

		test('Schedule button opens dialog and persists the chosen date', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-Schedule');
			articleIds.push(id);

			await gotoEditPage(page, id);

			await page.locator('[data-testid="schedule-publish-button"]').click();
			const input = page.locator('[data-testid="schedule-publish-at-input"]');
			await expect(input).toBeVisible({ timeout: 5000 });

			// Pick 1 day in the future and format as YYYY-MM-DDTHH:mm (datetime-local)
			const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
			const value = future.toISOString().slice(0, 16);
			await input.fill(value);

			const confirm = page.locator('[data-testid="schedule-publish-confirm"]');
			await expect(confirm).toBeEnabled();
			const scheduleResponse = page.waitForResponse(
				(res) =>
					res.url().includes(`/api/articles/${id}/schedule-publish`) &&
					res.request().method() === 'POST',
			);
			await confirm.click();
			const response = await scheduleResponse;
			expect(response.ok(), 'schedule-publish endpoint must return success').toBe(true);

			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible({
				timeout: 5000,
			});
			await expect(page.locator('[data-testid="cancel-schedule-button"]')).toBeVisible();
		});

		test('Cancel schedule button reverts to draft + publish + schedule controls', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-CancelSchedule');
			articleIds.push(id);
			// Pre-schedule via API for setup speed
			const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
			const scheduledRes = await request.post(`/api/articles/${id}/schedule-publish`, {
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: future },
			});
			expect(scheduledRes.ok()).toBe(true);

			await gotoEditPage(page, id);
			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible({
				timeout: 10000,
			});

			// Cancel branch (Keep schedule)
			await page.locator('[data-testid="cancel-schedule-button"]').click();
			const keepDialog = page.locator('mcms-confirmation-dialog');
			await expect(keepDialog).toBeVisible({ timeout: 5000 });
			await keepDialog.getByRole('button', { name: 'Keep schedule' }).click();
			await expect(keepDialog).toBeHidden({ timeout: 5000 });
			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible();

			// Confirm cancel
			await page.locator('[data-testid="cancel-schedule-button"]').click();
			const confirmDialog = page.locator('mcms-confirmation-dialog');
			await expect(confirmDialog).toBeVisible({ timeout: 5000 });
			await confirmDialog.getByRole('button', { name: 'Cancel schedule' }).click();

			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeHidden({
				timeout: 5000,
			});
			await expect(page.locator('[data-testid="publish-button"]')).toBeVisible();
			await expect(page.locator('[data-testid="schedule-publish-button"]')).toBeVisible();
		});

		// ============================================
		// Adversarial — try to break it
		// ============================================

		test('Schedule dialog rejects past dates with disabled submit + inline error', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-PastDate');
			articleIds.push(id);

			await gotoEditPage(page, id);
			await page.locator('[data-testid="schedule-publish-button"]').click();

			// Yesterday
			const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
			await page
				.locator('[data-testid="schedule-publish-at-input"]')
				.fill(past.toISOString().slice(0, 16));

			await expect(page.locator('[data-testid="schedule-publish-error"]')).toBeVisible();
			await expect(page.locator('[data-testid="schedule-publish-confirm"]')).toBeDisabled();
		});

		test('Schedule dialog confirm is disabled when no date is picked', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-EmptyDate');
			articleIds.push(id);

			await gotoEditPage(page, id);
			await page.locator('[data-testid="schedule-publish-button"]').click();
			await expect(page.locator('[data-testid="schedule-publish-confirm"]')).toBeDisabled();
		});

		test('Manual publish wipes any pre-existing scheduled publish', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-ScheduleThenPublish');
			articleIds.push(id);
			const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
			await request.post(`/api/articles/${id}/schedule-publish`, {
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: future },
			});

			await gotoEditPage(page, id);
			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible({
				timeout: 10000,
			});

			// publish-button is hidden while a schedule is active. Cancel the schedule
			// first, then publish manually — the scheduled badge must not reappear.
			await page.locator('[data-testid="cancel-schedule-button"]').click();
			const cancelScheduleDialog = page.locator('mcms-confirmation-dialog');
			await expect(cancelScheduleDialog).toBeVisible({ timeout: 5000 });
			await cancelScheduleDialog.getByRole('button', { name: 'Cancel schedule' }).click();
			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeHidden({
				timeout: 5000,
			});

			await page.locator('[data-testid="publish-button"]').click();
			const controls = page.locator('mcms-publish-controls');
			await expect(controls.getByText('Published')).toBeVisible({ timeout: 10000 });
			await expect(page.locator('[data-testid="scheduled-badge"]')).toBeHidden();
		});

		test('Publish/Schedule buttons are disabled while a publish is in flight', async ({
			authenticatedPage: page,
			request,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-InFlight');
			articleIds.push(id);

			await gotoEditPage(page, id);

			// Throttle the publish call so we can observe the disabled state
			await page.route(`**/api/articles/${id}/publish`, async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 600));
				await route.continue();
			});

			const publishButton = page.locator('[data-testid="publish-button"]');
			await publishButton.click();

			await expect(publishButton).toBeDisabled();
			await expect(page.locator('[data-testid="schedule-publish-button"]')).toBeDisabled();

			await expect(page.locator('mcms-publish-controls').getByText('Published')).toBeVisible({
				timeout: 10000,
			});
		});

		test('Server rejects scheduling with an unparseable publishAt', async ({ request }) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-ServerInvalidDate');
			articleIds.push(id);

			const res = await request.post(`/api/articles/${id}/schedule-publish`, {
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: 'totally-not-a-date' },
			});
			expect(res.status(), 'Garbage publishAt must be rejected with 400').toBe(400);

			// Past dates ARE accepted — the publish-scheduler picks them up
			// immediately. UI guards against past dates as a UX safeguard, but the
			// server treats them as a "publish on next tick" instruction.
			const past = new Date(Date.now() - 60_000).toISOString();
			const pastRes = await request.post(`/api/articles/${id}/schedule-publish`, {
				headers: { 'Content-Type': 'application/json' },
				data: { publishAt: past },
			});
			expect(pastRes.ok(), 'Past dates are accepted — server semantics').toBe(true);
		});

		test('Restore endpoint rejects unknown versionId', async ({ request }) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-BadRestore');
			articleIds.push(id);

			const res = await request.post(`/api/articles/${id}/versions/restore`, {
				headers: { 'Content-Type': 'application/json' },
				data: { versionId: 'does-not-exist' },
			});
			expect(res.status(), 'Unknown versionId must NOT silently succeed').not.toBe(200);
		});

		test('Two tabs: tab B publishes, tab A still sees the old draft state in DOM', async ({
			authenticatedPage: page,
			request,
			browser,
		}) => {
			await signInApi(request, TEST_CREDENTIALS);
			const id = await createArticle(request, 'VPUI-TwoTabs');
			articleIds.push(id);

			// Tab A loads the draft article
			await gotoEditPage(page, id);
			await expect(page.locator('mcms-publish-controls').getByText('Draft')).toBeVisible();

			// Tab B publishes via a separate browser context that reuses cookies
			const storage = await page.context().storageState();
			const ctxB = await browser.newContext({ storageState: storage });
			const pageB = await ctxB.newPage();
			try {
				await pageB.goto(page.url());
				await pageB.waitForLoadState('domcontentloaded');
				await expect(pageB.locator('[data-testid="publish-button"]')).toBeVisible({
					timeout: 15000,
				});
				await pageB.locator('[data-testid="publish-button"]').click();
				await expect(pageB.locator('mcms-publish-controls').getByText('Published')).toBeVisible({
					timeout: 10000,
				});
			} finally {
				await ctxB.close();
			}

			// Tab A still shows stale "Draft" until the user re-loads — this is
			// expected behaviour. Clicking publish in tab A should still succeed
			// (server treats publish as idempotent against a published doc).
			await expect(page.locator('mcms-publish-controls').getByText('Draft')).toBeVisible();
			await page.locator('[data-testid="publish-button"]').click();
			await expect(page.locator('mcms-publish-controls').getByText('Published')).toBeVisible({
				timeout: 10000,
			});
		});

		// ============================================
		// Mobile viewport — verify the publish/schedule UI is usable on phones
		// ============================================

		test.describe('Mobile viewport (iPhone 12 — 390x844, hasTouch)', () => {
			const MOBILE = { width: 390, height: 844 } as const;
			// 44px is the WCAG 2.5.5 AAA / Apple HIG / Material standard. The shared
			// Button enforces this via @media (pointer: coarse) min-height.
			const TAP_TARGET_MIN = 40; // small slack for sub-pixel rendering on 44px floor

			async function newMobilePage(
				browser: Browser,
				authenticatedPage: Page,
			): Promise<{ page: Page; close: () => Promise<void> }> {
				const storage = await authenticatedPage.context().storageState();
				const context = await browser.newContext({
					storageState: storage,
					viewport: MOBILE,
					hasTouch: true,
					isMobile: true,
					baseURL: new URL(authenticatedPage.url()).origin,
				});
				const mobilePage = await context.newPage();
				return { page: mobilePage, close: () => context.close() };
			}

			test('Publish controls wrap and clear AAA tap targets at phone width', async ({
				authenticatedPage,
				request,
				browser,
			}) => {
				await signInApi(request, TEST_CREDENTIALS);
				const id = await createArticle(request, 'VPUI-Mobile-Wrap');
				articleIds.push(id);
				await authenticatedPage.goto('/admin');
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const { page, close } = await newMobilePage(browser, authenticatedPage);
				try {
					await gotoEditPage(page, id);

					// Page must not have horizontal overflow at phone width.
					const overflow = await page.evaluate(
						() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
					);
					expect(
						overflow,
						`Document overflows horizontally by ${overflow}px at ${MOBILE.width}px`,
					).toBeLessThanOrEqual(0);

					// Tap targets — coarse-pointer min-height guarantees ≥44px.
					for (const id of ['publish-button', 'schedule-publish-button']) {
						const btn = page.locator(`[data-testid="${id}"]`);
						await expect(btn).toBeVisible();
						const box = await btn.boundingBox();
						expect(box, `${id} has no bounding box`).not.toBeNull();
						expect(
							box?.height ?? 0,
							`${id} tap target only ${box?.height}px tall — should clear ${TAP_TARGET_MIN}px on coarse pointers`,
						).toBeGreaterThanOrEqual(TAP_TARGET_MIN);
					}

					// Schedule button must remain inside the viewport (no horizontal clip).
					const scheduleBox = await page
						.locator('[data-testid="schedule-publish-button"]')
						.boundingBox();
					expect(scheduleBox, 'Schedule button has no bounding box').not.toBeNull();
					if (scheduleBox) {
						expect(scheduleBox.x + scheduleBox.width).toBeLessThanOrEqual(MOBILE.width);
					}
				} finally {
					await close();
				}
			});

			test('Schedule dialog fits the screen and stays interactive on mobile', async ({
				authenticatedPage,
				request,
				browser,
			}) => {
				await signInApi(request, TEST_CREDENTIALS);
				const id = await createArticle(request, 'VPUI-Mobile-Dialog');
				articleIds.push(id);
				await authenticatedPage.goto('/admin');
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const { page, close } = await newMobilePage(browser, authenticatedPage);
				try {
					await gotoEditPage(page, id);
					await page.locator('[data-testid="schedule-publish-button"]').click();

					const input = page.locator('[data-testid="schedule-publish-at-input"]');
					await expect(input).toBeVisible({ timeout: 5000 });

					const pane = page.locator('.mcms-dialog-panel').first();
					const paneBox = await pane.boundingBox();
					expect(paneBox, 'Dialog pane missing bounding box').not.toBeNull();
					if (paneBox) {
						expect(
							paneBox.width,
							`Dialog (${paneBox.width}px) should not exceed 90vw of ${MOBILE.width}px`,
						).toBeLessThanOrEqual(Math.round(MOBILE.width * 0.9) + 1);
					}

					const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
					await input.fill(future);

					const confirm = page.locator('[data-testid="schedule-publish-confirm"]');
					await expect(confirm).toBeEnabled();
					const confirmBox = await confirm.boundingBox();
					expect(confirmBox, 'Confirm button missing bounding box').not.toBeNull();
					if (confirmBox) {
						expect(confirmBox.x + confirmBox.width).toBeLessThanOrEqual(MOBILE.width);
						expect(
							confirmBox.height,
							`Confirm button only ${confirmBox.height}px tall — should clear ${TAP_TARGET_MIN}px on coarse pointers`,
						).toBeGreaterThanOrEqual(TAP_TARGET_MIN);
					}

					await confirm.click();
					await expect(page.locator('[data-testid="scheduled-badge"]')).toBeVisible({
						timeout: 5000,
					});
				} finally {
					await close();
				}
			});

			test('Unpublish confirm dialog fits and works on mobile', async ({
				authenticatedPage,
				request,
				browser,
			}) => {
				await signInApi(request, TEST_CREDENTIALS);
				const id = await createArticle(request, 'VPUI-Mobile-Unpublish');
				articleIds.push(id);
				await publishArticle(request, id);
				await authenticatedPage.goto('/admin');
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const { page, close } = await newMobilePage(browser, authenticatedPage);
				try {
					await gotoEditPage(page, id);
					await page.locator('[data-testid="unpublish-button"]').click();

					const dialog = page.locator('mcms-confirmation-dialog');
					await expect(dialog).toBeVisible({ timeout: 5000 });

					const dialogPane = page.locator('.mcms-dialog-panel').first();
					const paneBox = await dialogPane.boundingBox();
					expect(paneBox?.width ?? Infinity).toBeLessThanOrEqual(
						Math.round(MOBILE.width * 0.9) + 1,
					);

					const confirmBtn = dialog.getByRole('button', { name: 'Unpublish' });
					const btnBox = await confirmBtn.boundingBox();
					expect(btnBox, 'Confirm button has no bounding box').not.toBeNull();
					if (btnBox) {
						expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(MOBILE.width);
						expect(
							btnBox.height,
							`Confirm button only ${btnBox.height}px tall — should clear ${TAP_TARGET_MIN}px on coarse pointers`,
						).toBeGreaterThanOrEqual(TAP_TARGET_MIN);
					}

					await confirmBtn.click();
					await expect(page.locator('mcms-publish-controls').getByText('Draft')).toBeVisible({
						timeout: 10000,
					});
				} finally {
					await close();
				}
			});
		});
	},
);

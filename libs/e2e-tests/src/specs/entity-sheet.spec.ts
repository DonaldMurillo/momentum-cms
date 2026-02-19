import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { Page, Locator } from '@playwright/test';

/**
 * Entity Sheet E2E Tests
 *
 * Tests the entity sheet feature: a slide-over panel driven by query parameters
 * that can create/edit/view any entity from anywhere in the app.
 *
 * Uses the Articles collection which has a `category` relationship field to Categories.
 * Categories require `name` and `slug` fields.
 *
 * NOTE: These tests interact with Angular event handlers, so they require Angular
 * to be fully hydrated (SSR → client). We use element-visibility waits and
 * retry-polling to handle the hydration window.
 */

/**
 * Navigate to the articles create form and wait for it to be interactive.
 * Waits for form to render and Angular to hydrate before returning.
 */
async function navigateToArticlesForm(page: Page): Promise<Locator> {
	await page.goto('/admin/collections/articles/new');

	// Wait for form to render (submit button at bottom confirms Angular is active)
	const main = page.locator('main');
	await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeVisible({
		timeout: 10000,
	});

	const relationshipField = page.locator('mcms-relationship-field-renderer');
	await expect(relationshipField).toBeVisible({ timeout: 10000 });
	return relationshipField;
}

/**
 * Opens the entity sheet by clicking the New button on the relationship field.
 * Retries the click to handle SSR hydration timing — the button may be
 * server-rendered but Angular event handlers not yet bound.
 */
async function openSheetViaNewButton(page: Page, relationshipField: Locator): Promise<Locator> {
	const newButton = relationshipField.getByRole('button', { name: /new/i });
	const sheetDialog = page.locator('[role="dialog"][aria-modal="true"]');

	await expect
		.poll(
			async () => {
				if (await sheetDialog.isVisible()) return true;
				// Use dispatchEvent instead of click() to avoid blocking on actionability checks
				// (e.g., backdrop intercepting pointer events after the sheet starts opening).
				// If Angular hasn't hydrated yet, the event does nothing and the poll retries.
				if (await newButton.isVisible()) {
					await newButton.dispatchEvent('click');
				}
				return sheetDialog.isVisible();
			},
			{ timeout: 15000, message: 'Entity sheet should open after clicking New button' },
		)
		.toBe(true);

	return sheetDialog;
}

test.describe('Entity Sheet', { tag: ['@admin', '@crud'] }, () => {
	test.describe('Sheet from relationship field', () => {
		test('should show New button on relationship field', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			// The "New" button should be visible
			const newButton = relationshipField.getByRole('button', { name: /new/i });
			await expect(newButton).toBeVisible();
		});

		test('should open create sheet when clicking New button', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// URL should contain sheet query params
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, { timeout: 5000 });

			// Sheet should show "Create Category" heading (verifies the correct collection)
			// Both sheet header (h2) and form heading (h1) show it — use first()
			const sheetHeading = sheetDialog.getByRole('heading', { name: /Create Category/i }).first();
			await expect(sheetHeading).toBeVisible();
		});

		test('should create entity in sheet and auto-select it', async ({
			authenticatedPage,
			request,
		}) => {
			// Sign in for API cleanup
			const signInResp = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			expect(signInResp.ok()).toBe(true);

			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Fill in the category form fields (name and slug are required)
			const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const uniqueName = `Sheet Test Category ${suffix}`;
			const uniqueSlug = `sheet-test-${suffix}`;

			await sheetDialog.locator('input#field-name').fill(uniqueName);
			await sheetDialog.locator('input#field-slug').fill(uniqueSlug);

			// Click Create button inside the sheet
			const createButton = sheetDialog.getByRole('button', { name: 'Create' });
			await createButton.click();

			// Sheet should close
			await expect(sheetDialog).not.toBeVisible({ timeout: 10000 });

			// URL should no longer contain sheet query params
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);

			// Wait for the dropdown to auto-select the newly created entity
			let selectedId = '';
			await expect
				.poll(
					async () => {
						const selectEl = relationshipField.locator('select');
						selectedId = await selectEl.inputValue();
						return selectedId;
					},
					{ timeout: 10000, message: 'New category should be auto-selected' },
				)
				.not.toBe('');

			// Verify the selected entity is the one we just created (by fetching it and checking slug)
			const catResponse = await request.get(`/api/categories/${selectedId}`);
			expect(catResponse.ok()).toBe(true);
			const catData = (await catResponse.json()) as {
				doc: { id: string; slug: string };
			};
			expect(catData.doc.slug).toBe(uniqueSlug);

			// Clean up
			const deleteResp = await request.delete(`/api/categories/${selectedId}`);
			expect(deleteResp.ok()).toBe(true);
		});

		test('should show View button when entity is selected', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const selectEl = relationshipField.locator('select');
			const viewButton = relationshipField.getByRole('button', { name: /view/i });

			// Initially no "View" button (nothing selected)
			await expect(viewButton).not.toBeVisible();

			// Select a category — retry to handle hydration timing for (change) handler
			await expect
				.poll(
					async () => {
						if (!(await viewButton.isVisible())) {
							await selectEl.selectOption({ index: 1 });
						}
						return viewButton.isVisible();
					},
					{
						timeout: 15000,
						message: 'View button should appear after selecting a category',
					},
				)
				.toBe(true);
		});

		test('should open view sheet when clicking View button', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const selectEl = relationshipField.locator('select');
			const viewButton = relationshipField.getByRole('button', { name: /view/i });

			// Select a category — retry for hydration
			await expect
				.poll(
					async () => {
						if (!(await viewButton.isVisible())) {
							await selectEl.selectOption({ index: 1 });
						}
						return viewButton.isVisible();
					},
					{
						timeout: 15000,
						message: 'View button should appear after selecting a category',
					},
				)
				.toBe(true);

			// Click "View" button — may also need hydration retry
			const sheetDialog = authenticatedPage.locator('[role="dialog"][aria-modal="true"]');
			await expect
				.poll(
					async () => {
						if (await sheetDialog.isVisible()) return true;
						if (await viewButton.isVisible()) {
							await viewButton.dispatchEvent('click');
						}
						return sheetDialog.isVisible();
					},
					{ timeout: 15000, message: 'View sheet should open' },
				)
				.toBe(true);

			// URL should contain sheet query params
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, { timeout: 5000 });
			await expect(authenticatedPage).toHaveURL(/sheetMode=view/, { timeout: 5000 });
		});
	});

	test.describe('Sheet close behavior', () => {
		test('should close on backdrop click', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Click the backdrop (the presentation wrapper div, not breadcrumb separators)
			const backdrop = authenticatedPage.locator('div[role="presentation"]');
			await backdrop.click({ position: { x: 10, y: 300 } });

			// Sheet should close
			await expect(sheetDialog).not.toBeVisible({ timeout: 5000 });

			// URL should be clean
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);
		});

		test('should close on Escape key', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Wait for sheet URL params to be committed before closing
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, { timeout: 5000 });

			// Press Escape
			await authenticatedPage.keyboard.press('Escape');

			// Sheet should close (200ms animation + navigation)
			await expect(sheetDialog).not.toBeVisible({ timeout: 10000 });

			// URL should be clean
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);
		});

		test('should close on close button click', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Wait for sheet URL params to be committed before closing
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, { timeout: 5000 });

			// Click the close button inside the sheet
			const closeButton = sheetDialog.getByRole('button', { name: /close sheet/i });
			await closeButton.click();

			// Sheet should close (200ms animation + navigation)
			await expect(sheetDialog).not.toBeVisible({ timeout: 10000 });

			// URL should be clean
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);
		});
	});

	test.describe('URL state', () => {
		test('should reflect sheet state in URL with query params', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			await openSheetViaNewButton(authenticatedPage, relationshipField);

			// URL should have sheet query params (auto-retry via toHaveURL)
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, {
				timeout: 5000,
			});
			await expect(authenticatedPage).toHaveURL(/sheetMode=create/, { timeout: 5000 });

			// Close sheet
			const sheetDialog = authenticatedPage.locator('[role="dialog"][aria-modal="true"]');
			await authenticatedPage.keyboard.press('Escape');
			await expect(sheetDialog).not.toBeVisible({ timeout: 10000 });

			// URL should be clean (auto-retry via toHaveURL)
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);
			await expect(authenticatedPage).not.toHaveURL(/sheetMode/);
		});

		test('should restore sheet state on page refresh', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Verify URL has sheet state
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, {
				timeout: 5000,
			});
			await expect(authenticatedPage).toHaveURL(/sheetMode=create/, { timeout: 5000 });

			// Refresh the page
			await authenticatedPage.reload();

			// Sheet should reappear after hydration
			const sheetDialog = authenticatedPage.locator('[role="dialog"][aria-modal="true"]');
			await expect(sheetDialog).toBeVisible({ timeout: 15000 });

			// Sheet should still show "Create Category" heading
			const sheetHeading = sheetDialog.getByRole('heading', { name: /Create Category/i }).first();
			await expect(sheetHeading).toBeVisible({ timeout: 10000 });

			// URL should still contain the sheet state
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/);
			await expect(authenticatedPage).toHaveURL(/sheetMode=create/);
		});

		test('should close sheet on browser back button', async ({ authenticatedPage }) => {
			const relationshipField = await navigateToArticlesForm(authenticatedPage);

			const sheetDialog = await openSheetViaNewButton(authenticatedPage, relationshipField);

			// Wait for sheet URL params to be committed
			await expect(authenticatedPage).toHaveURL(/sheetCollection=categories/, { timeout: 5000 });

			// Go back
			await authenticatedPage.goBack();

			// Sheet should close (URL params removed by browser back)
			await expect(sheetDialog).not.toBeVisible({ timeout: 10000 });

			// URL should no longer contain sheet query params
			await expect(authenticatedPage).not.toHaveURL(/sheetCollection/);
		});
	});
});

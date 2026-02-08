import { test, expect } from './fixtures';

/**
 * Bulk Actions UI E2E Tests
 *
 * Tests the frontend bulk delete flow in the admin collection list page.
 * Verifies: selection checkboxes, bulk action toolbar, batch delete via API,
 * confirmation dialog, and list refresh after deletion.
 */
test.describe('Bulk actions UI', () => {
	// Create test categories via API before each test
	test.beforeEach(async ({ authenticatedPage }) => {
		// authenticatedPage.request inherits cookies from the authenticated browser context
		const request = authenticatedPage.request;

		// Clean up leftover bulk test categories
		const listResponse = await request.get('/api/categories?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; slug?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.slug?.startsWith('bulk-ui-')) {
					await request.delete(`/api/categories/${doc.id}`);
				}
			}
		}

		// Create fresh test categories
		const createResponse = await request.post('/api/categories/batch', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				operation: 'create',
				items: [
					{ name: 'Bulk UI Alpha', slug: 'bulk-ui-alpha' },
					{ name: 'Bulk UI Beta', slug: 'bulk-ui-beta' },
					{ name: 'Bulk UI Gamma', slug: 'bulk-ui-gamma' },
				],
			},
		});
		expect(createResponse.status(), 'Batch create must succeed').toBe(201);
	});

	test('collection list shows selection checkboxes', async ({ authenticatedPage }) => {
		// Navigate via client-side to avoid SSR hydration issues
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		// Wait for table to load with data
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Checkboxes render as <button role="checkbox"> inside mcms-checkbox
		const checkboxes = authenticatedPage.locator('mcms-table button[role="checkbox"]');
		await expect(checkboxes.first()).toBeVisible();
	});

	test('selecting items shows bulk action toolbar with count', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Click the first row checkbox (inside mcms-table-row, skip header)
		const rowCheckboxes = authenticatedPage.locator(
			'mcms-table-body mcms-table-row mcms-checkbox button[role="checkbox"]',
		);
		await rowCheckboxes.first().click();

		// Bulk action toolbar should appear with "1 selected" badge
		await expect(authenticatedPage.getByText('1 selected')).toBeVisible({ timeout: 5000 });

		// Delete button should be visible
		const deleteButton = authenticatedPage.getByRole('button', { name: /Delete/i });
		await expect(deleteButton).toBeVisible();
	});

	test('bulk delete removes selected items after confirmation', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Verify our test categories exist
		await expect(
			authenticatedPage
				.locator('mcms-table-cell')
				.filter({ hasText: /Bulk UI Alpha/i })
				.first(),
		).toBeVisible();

		// Select the test categories using row checkboxes
		const rows = authenticatedPage.locator('mcms-table-row');
		const rowCount = await rows.count();

		for (let i = 0; i < rowCount; i++) {
			const row = rows.nth(i);
			const cellText = await row.textContent();
			if (cellText?.includes('Bulk UI')) {
				const checkbox = row.locator('mcms-checkbox button[role="checkbox"]');
				await checkbox.click();
			}
		}

		// Click the Delete button in the bulk toolbar
		const deleteButton = authenticatedPage.getByRole('button', { name: /Delete/i });
		await expect(deleteButton).toBeVisible();
		await deleteButton.click();

		// Confirmation dialog should appear
		const dialog = authenticatedPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5000 });
		const confirmButton = dialog.getByRole('button', { name: /Delete/i });
		await expect(confirmButton).toBeVisible();
		await confirmButton.click();

		// Verify the bulk test categories are gone (waitForTimeout removed — expect already has timeout)
		const alphaCell = authenticatedPage
			.locator('mcms-table-cell')
			.filter({ hasText: /Bulk UI Alpha/i });
		await expect(alphaCell).toHaveCount(0, { timeout: 10000 });

		// Verify via API that they're actually deleted
		const request = authenticatedPage.request;
		const slugsResponse = await request.get('/api/categories/slugs');

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).not.toContain('bulk-ui-alpha');
		expect(slugsData.slugs).not.toContain('bulk-ui-beta');
		expect(slugsData.slugs).not.toContain('bulk-ui-gamma');
	});

	test('cancelling bulk delete confirmation preserves items', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Select a row
		const rowCheckboxes = authenticatedPage.locator(
			'mcms-table-body mcms-table-row mcms-checkbox button[role="checkbox"]',
		);
		await rowCheckboxes.first().click();

		// Click Delete
		const deleteButton = authenticatedPage.getByRole('button', { name: /Delete/i });
		await deleteButton.click();

		// Cancel the confirmation
		const cancelButton = authenticatedPage.getByRole('button', { name: /Cancel/i });
		await expect(cancelButton).toBeVisible({ timeout: 5000 });
		await cancelButton.click();

		// Items should still be in the table
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 5000,
		});

		// Verify via API that items still exist
		const request = authenticatedPage.request;
		const slugsResponse = await request.get('/api/categories/slugs');

		const slugsData = (await slugsResponse.json()) as { slugs: string[] };
		expect(slugsData.slugs).toContain('bulk-ui-alpha');
		expect(slugsData.slugs).toContain('bulk-ui-beta');
		expect(slugsData.slugs).toContain('bulk-ui-gamma');
	});
});

import { test, expect } from './fixtures';

/**
 * Signal Forms E2E Tests
 *
 * Tests the Angular Signal Forms integration in the admin UI, covering:
 * - Validate-on-blur (not on keystroke)
 * - Humanized error messages
 * - Live error clearing
 * - Number validation without clamping
 * - Submit feedback for invalid forms
 * - Create and edit flows
 *
 * Uses the field-test-items collection:
 * - title: text, required, minLength: 3, maxLength: 100
 * - code: text, required, minLength: 2, maxLength: 10
 * - contactEmail: email
 * - rating: number, min: 1, max: 5, step: 1
 * - price: number, min: 0
 * - status: select (active/draft/archived), required
 * - tags: array, minRows: 1, maxRows: 5, sub-field: label (text, required)
 *
 * NOTE: Uses pressSequentially() instead of fill() because the mcms-input
 * component updates signals via native (input) events, which pressSequentially()
 * reliably fires per keystroke.
 */

/** Helper to type into a field (click + clear + type) */
async function typeIntoField(
	locator: import('@playwright/test').Locator,
	text: string,
): Promise<void> {
	await locator.click();
	await locator.pressSequentially(text, { delay: 20 });
}

/** Helper to replace text in a field (select all + type) */
async function replaceFieldText(
	page: import('@playwright/test').Page,
	locator: import('@playwright/test').Locator,
	text: string,
): Promise<void> {
	await locator.click();
	await page.keyboard.press('ControlOrMeta+a');
	await locator.pressSequentially(text, { delay: 20 });
}

test.describe('Signal Forms - Validation Behavior', () => {
	test('should show humanized labels in error messages', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Type title with value below minLength (3)
		const titleInput = authenticatedPage.locator('input#field-title');
		await typeIntoField(titleInput, 'ab');
		await titleInput.blur();

		// Error should show humanized "Title" not raw "title"
		await expect(authenticatedPage.getByText(/Title must be at least 3 characters/)).toBeVisible({
			timeout: 5000,
		});
	});

	test('should not show errors on untouched fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Don't interact with any fields — verify no validation errors visible
		await expect(authenticatedPage.getByText(/is required/)).not.toBeVisible();
		await expect(authenticatedPage.getByText(/must be at least/)).not.toBeVisible();
	});

	test('should validate on blur, not on every keystroke', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const titleInput = authenticatedPage.locator('input#field-title');

		// Type one character — no error yet (field not blurred)
		await typeIntoField(titleInput, 'a');
		await expect(
			authenticatedPage.getByText(/Title must be at least 3 characters/),
		).not.toBeVisible();

		// Blur — now the error should appear
		await titleInput.blur();
		await expect(authenticatedPage.getByText(/Title must be at least 3 characters/)).toBeVisible({
			timeout: 5000,
		});
	});

	test('should clear error when user fixes the value', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const titleInput = authenticatedPage.locator('input#field-title');

		// Trigger error
		await typeIntoField(titleInput, 'ab');
		await titleInput.blur();
		await expect(authenticatedPage.getByText(/Title must be at least 3 characters/)).toBeVisible({
			timeout: 5000,
		});

		// Fix it — error should clear (field is already touched, live clearing)
		await replaceFieldText(authenticatedPage, titleInput, 'Valid Title');
		await expect(
			authenticatedPage.getByText(/Title must be at least 3 characters/),
		).not.toBeVisible({ timeout: 5000 });
	});

	test('should show number max validation error without clamping', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const ratingInput = authenticatedPage.locator('input#field-rating');
		await typeIntoField(ratingInput, '6');
		await ratingInput.blur();

		// Should show error, NOT silently clamp to 5
		await expect(authenticatedPage.getByText(/Rating must be no more than 5/)).toBeVisible({
			timeout: 5000,
		});
		// Value should remain 6 (not clamped)
		await expect(ratingInput).toHaveValue('6');
	});

	test('should show number min validation error', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const ratingInput = authenticatedPage.locator('input#field-rating');
		await typeIntoField(ratingInput, '0');
		await ratingInput.blur();

		await expect(authenticatedPage.getByText(/Rating must be at least 1/)).toBeVisible({
			timeout: 5000,
		});
	});

	test('should validate email format', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const emailInput = authenticatedPage.locator('input#field-contactEmail');
		await typeIntoField(emailInput, 'not-an-email');
		await emailInput.blur();

		await expect(authenticatedPage.getByText(/Contact Email must be a valid email/)).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe('Signal Forms - Submit Behavior', () => {
	test('should show form-level error when submitting with validation errors', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const createButton = authenticatedPage.getByRole('button', {
			name: 'Create',
			exact: true,
		});
		await expect(createButton).toBeVisible();

		// Click Create without filling required fields
		await createButton.click();

		// Should show a form-level error message
		await expect(authenticatedPage.getByText(/Please fix the errors above/)).toBeVisible({
			timeout: 5000,
		});

		// All required fields should now show errors (submit marks all as touched)
		await expect(authenticatedPage.getByText(/Title is required/)).toBeVisible({
			timeout: 5000,
		});
		await expect(authenticatedPage.getByText(/Status is required/)).toBeVisible({
			timeout: 5000,
		});
	});

	test('should successfully create and navigate to list', async ({ authenticatedPage }) => {
		const timestamp = Date.now();
		await authenticatedPage.goto('/admin/collections/field-test-items/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Fill all required fields with valid data
		await typeIntoField(
			authenticatedPage.locator('input#field-title'),
			`E2E Signal Form ${timestamp}`,
		);
		await typeIntoField(authenticatedPage.locator('input#field-code'), 'SF01');
		await authenticatedPage.locator('select#field-status').selectOption('active');

		// Add one tag row (minRows: 1)
		await authenticatedPage.getByRole('button', { name: 'Add Row' }).click();
		// Wait for the new row to appear, then fill the label
		const tagInput = authenticatedPage.locator('input#field-tags-0-label');
		await expect(tagInput).toBeVisible({ timeout: 5000 });
		await typeIntoField(tagInput, 'test-tag');

		// Submit
		await authenticatedPage.getByRole('button', { name: 'Create', exact: true }).click();

		// Should navigate to collection list on success
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/field-test-items$/, {
			timeout: 10000,
		});

		// Verify via API
		const response = await authenticatedPage.request.get('/api/field-test-items?limit=100');
		const data = await response.json();
		const created = data.docs.find(
			(doc: { title: string }) => doc.title === `E2E Signal Form ${timestamp}`,
		);
		expect(created).toBeDefined();
		expect(created.code).toBe('SF01');
		expect(created.status).toBe('active');
	});
});

test.describe('Signal Forms - Edit Flow', () => {
	test('should load existing data and save edits', async ({ authenticatedPage }) => {
		const timestamp = Date.now();

		// Create via API (authenticatedPage.request is already authenticated)
		const createRes = await authenticatedPage.request.post('/api/field-test-items', {
			data: {
				title: `Edit Test ${timestamp}`,
				code: 'ED01',
				status: 'draft',
				tags: [{ label: 'tag1' }],
			},
		});
		expect(createRes.status()).toBe(201);
		const created = await createRes.json();
		const docId = created.doc?.id ?? created.id;
		expect(docId).toBeTruthy();

		// Navigate to edit page
		await authenticatedPage.goto(`/admin/collections/field-test-items/${docId}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible({
			timeout: 15000,
		});

		// Verify pre-filled values
		await expect(authenticatedPage.locator('input#field-title')).toHaveValue(
			`Edit Test ${timestamp}`,
		);

		// Edit title
		await replaceFieldText(
			authenticatedPage,
			authenticatedPage.locator('input#field-title'),
			`Edited ${timestamp}`,
		);

		// Save
		await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/field-test-items$/, {
			timeout: 10000,
		});

		// Verify via API — use list endpoint for consistent response shape
		const listRes = await authenticatedPage.request.get('/api/field-test-items?limit=100');
		const listData = await listRes.json();
		const updated = listData.docs.find((doc: { id: string }) => doc.id === docId);
		expect(updated).toBeDefined();
		expect(updated.title).toBe(`Edited ${timestamp}`);
	});
});

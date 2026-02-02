import { test, expect } from '@playwright/test';

test.describe('Collection Create Form - Posts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/posts/create');
		// Wait for form to be fully hydrated
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
	});

	test('should display Create heading', async ({ page }) => {
		const heading = page.getByRole('heading', { name: /Create Post/i });
		await expect(heading).toBeVisible();
	});

	test('should have back link to list', async ({ page }) => {
		const backLink = page.getByRole('link', { name: /Back to list/i });
		await expect(backLink).toBeVisible();
	});

	test('should navigate back to list when clicking back link', async ({ page }) => {
		const backLink = page.getByRole('link', { name: /Back to list/i });
		await backLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should display all Posts fields', async ({ page }) => {
		// Title field
		const titleLabel = page.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = page.locator('input#title');
		await expect(titleInput).toBeVisible();

		// URL Slug field
		const slugLabel = page.getByText('URL Slug');
		await expect(slugLabel).toBeVisible();
		const slugInput = page.locator('input#slug');
		await expect(slugInput).toBeVisible();

		// Content field (textarea)
		const contentLabel = page.getByText('Content');
		await expect(contentLabel).toBeVisible();
		const contentTextarea = page.locator('textarea#content');
		await expect(contentTextarea).toBeVisible();

		// Status field (select)
		const statusLabel = page.getByText('Status');
		await expect(statusLabel).toBeVisible();
		const statusSelect = page.locator('select#status');
		await expect(statusSelect).toBeVisible();

		// Featured field (checkbox)
		const featuredLabel = page.getByText('Featured Post');
		await expect(featuredLabel).toBeVisible();
		const featuredCheckbox = page.locator('input#featured');
		await expect(featuredCheckbox).toBeVisible();
	});

	test('should show required indicator on required fields', async ({ page }) => {
		// Title and Slug are required - check for asterisks
		const titleRequired = page.getByText('Title').locator('..').getByText('*');
		const slugRequired = page.getByText('URL Slug').locator('..').getByText('*');
		await expect(titleRequired).toBeVisible();
		await expect(slugRequired).toBeVisible();
	});

	test('should have status select with correct options', async ({ page }) => {
		const statusSelect = page.locator('select#status');

		// Check for placeholder
		await expect(statusSelect.locator('option[value=""]')).toHaveText('Select...');

		// Check for options
		await expect(statusSelect.locator('option[value="draft"]')).toHaveText('Draft');
		await expect(statusSelect.locator('option[value="published"]')).toHaveText('Published');
		await expect(statusSelect.locator('option[value="archived"]')).toHaveText('Archived');
	});

	test('should have Create submit button', async ({ page }) => {
		const submitButton = page.getByRole('button', { name: 'Create' });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel link', async ({ page }) => {
		const cancelLink = page.getByRole('link', { name: 'Cancel' });
		await expect(cancelLink).toBeVisible();
	});

	test('should fill out form fields', async ({ page }) => {
		// Fill title
		await page.locator('input#title').fill('Test Post Title');
		await expect(page.locator('input#title')).toHaveValue('Test Post Title');

		// Fill slug
		await page.locator('input#slug').fill('test-post-title');
		await expect(page.locator('input#slug')).toHaveValue('test-post-title');

		// Fill content
		await page.locator('textarea#content').fill('This is the test content.');
		await expect(page.locator('textarea#content')).toHaveValue('This is the test content.');

		// Select status
		await page.locator('select#status').selectOption('published');
		await expect(page.locator('select#status')).toHaveValue('published');

		// Check featured
		await page.locator('input#featured').check();
		await expect(page.locator('input#featured')).toBeChecked();
	});

	test('should successfully create a new post and redirect to list', async ({ page }) => {
		const timestamp = Date.now();
		const title = `E2E Test Post ${timestamp}`;
		const slug = `e2e-test-post-${timestamp}`;

		// Fill required fields
		await page.locator('input#title').fill(title);
		await page.locator('input#slug').fill(slug);

		// Fill optional fields
		await page.locator('textarea#content').fill('Content from E2E test');
		await page.locator('select#status').selectOption('published');
		await page.locator('input#featured').check();

		// Submit form
		const submitButton = page.getByRole('button', { name: 'Create' });
		await submitButton.click();

		// Should redirect to list page after successful creation
		await expect(page).toHaveURL(/\/admin\/collections\/posts$/, { timeout: 10000 });

		// Verify the new post appears in the list
		await expect(page.getByText(title)).toBeVisible();
	});

	test('should create post with checkbox unchecked (boolean false)', async ({ page }) => {
		const timestamp = Date.now();
		const title = `Post Without Featured ${timestamp}`;
		const slug = `post-without-featured-${timestamp}`;

		// Fill required fields only - leave featured unchecked
		await page.locator('input#title').fill(title);
		await page.locator('input#slug').fill(slug);

		// Ensure featured is NOT checked
		await expect(page.locator('input#featured')).not.toBeChecked();

		// Submit form
		const submitButton = page.getByRole('button', { name: 'Create' });
		await submitButton.click();

		// Should redirect to list page after successful creation
		await expect(page).toHaveURL(/\/admin\/collections\/posts$/, { timeout: 10000 });

		// Verify the new post appears in the list
		await expect(page.getByText(title)).toBeVisible();
	});
});

test.describe('Collection Create Form - Users', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/users/create');
		// Wait for form to be fully hydrated
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
	});

	test('should display Create heading', async ({ page }) => {
		const heading = page.getByRole('heading', { name: /Create User/i });
		await expect(heading).toBeVisible();
	});

	test('should display all Users fields', async ({ page }) => {
		// Name field
		const nameLabel = page.getByText('Name');
		await expect(nameLabel).toBeVisible();
		const nameInput = page.locator('input#name');
		await expect(nameInput).toBeVisible();

		// Email field
		const emailLabel = page.getByText('Email');
		await expect(emailLabel).toBeVisible();
		const emailInput = page.locator('input#email');
		await expect(emailInput).toBeVisible();
		await expect(emailInput).toHaveAttribute('type', 'email');

		// Role field (select)
		const roleLabel = page.getByText('Role');
		await expect(roleLabel).toBeVisible();
		const roleSelect = page.locator('select#role');
		await expect(roleSelect).toBeVisible();

		// Active field (checkbox)
		const activeLabel = page.getByText('Active');
		await expect(activeLabel).toBeVisible();
		const activeCheckbox = page.locator('input#active');
		await expect(activeCheckbox).toBeVisible();
	});

	test('should have role select with correct options', async ({ page }) => {
		const roleSelect = page.locator('select#role');

		await expect(roleSelect.locator('option[value="admin"]')).toHaveText('Admin');
		await expect(roleSelect.locator('option[value="editor"]')).toHaveText('Editor');
		await expect(roleSelect.locator('option[value="viewer"]')).toHaveText('Viewer');
	});

	test('should fill out user form fields', async ({ page }) => {
		// Fill name
		const nameInput = page.locator('input#name');
		await expect(nameInput).toBeVisible();
		await nameInput.click();
		await nameInput.fill('John Doe');
		await expect(nameInput).toHaveValue('John Doe');

		// Fill email
		const emailInput = page.locator('input#email');
		await expect(emailInput).toBeVisible();
		await emailInput.click();
		await emailInput.fill('john@example.com');
		await expect(emailInput).toHaveValue('john@example.com');

		// Select role
		const roleSelect = page.locator('select#role');
		await roleSelect.selectOption('admin');
		await expect(roleSelect).toHaveValue('admin');

		// Check active
		const activeCheckbox = page.locator('input#active');
		await activeCheckbox.check();
		await expect(activeCheckbox).toBeChecked();
	});

	test('should successfully create a new user and redirect to list', async ({ page }) => {
		const timestamp = Date.now();
		const name = `E2E Test User ${timestamp}`;
		const email = `e2e-${timestamp}@test.com`;

		// Fill required fields
		await page.locator('input#name').fill(name);
		await page.locator('input#email').fill(email);
		await page.locator('select#role').selectOption('editor');
		await page.locator('input#active').check();

		// Submit form
		const submitButton = page.getByRole('button', { name: 'Create' });
		await submitButton.click();

		// Should redirect to list page after successful creation
		await expect(page).toHaveURL(/\/admin\/collections\/users$/, { timeout: 10000 });

		// Verify the new user appears in the list
		await expect(page.getByText(name)).toBeVisible();
	});
});

test.describe('Collection Edit Form - Cancel Navigation', () => {
	test('should navigate back to list when clicking Cancel on Posts', async ({ page }) => {
		await page.goto('/admin/collections/posts/create');

		const cancelLink = page.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should navigate back to list when clicking Cancel on Users', async ({ page }) => {
		await page.goto('/admin/collections/users/create');

		const cancelLink = page.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users$/);
	});
});

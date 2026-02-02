import { test, expect } from '@playwright/test';

test.describe('Collection Create Form - Posts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/posts/create');
	});

	test('should display Create heading', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const heading = mainContent.getByRole('heading', { name: /Create Post/i });
		await expect(heading).toBeVisible();
	});

	test('should have back link to list', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const backLink = mainContent.getByRole('link', { name: /Back to list/i });
		await expect(backLink).toBeVisible();
	});

	test('should navigate back to list when clicking back link', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const backLink = mainContent.getByRole('link', { name: /Back to list/i });
		await backLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should display all Posts fields', async ({ page }) => {
		const form = page.locator('.mcms-form');

		// Title field
		const titleLabel = form.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = form.locator('input#title');
		await expect(titleInput).toBeVisible();

		// URL Slug field
		const slugLabel = form.getByText('URL Slug');
		await expect(slugLabel).toBeVisible();
		const slugInput = form.locator('input#slug');
		await expect(slugInput).toBeVisible();

		// Content field (textarea)
		const contentLabel = form.getByText('Content');
		await expect(contentLabel).toBeVisible();
		const contentTextarea = form.locator('textarea#content');
		await expect(contentTextarea).toBeVisible();

		// Status field (select)
		const statusLabel = form.getByText('Status');
		await expect(statusLabel).toBeVisible();
		const statusSelect = form.locator('select#status');
		await expect(statusSelect).toBeVisible();

		// Featured field (checkbox)
		const featuredLabel = form.getByText('Featured Post');
		await expect(featuredLabel).toBeVisible();
		const featuredCheckbox = form.locator('input#featured');
		await expect(featuredCheckbox).toBeVisible();
	});

	test('should show required indicator on required fields', async ({ page }) => {
		const form = page.locator('.mcms-form');
		// Title and Slug are required
		const requiredIndicators = form.locator('.mcms-required');
		await expect(requiredIndicators).toHaveCount(2);
	});

	test('should have status select with correct options', async ({ page }) => {
		const form = page.locator('.mcms-form');
		const statusSelect = form.locator('select#status');

		// Check for placeholder
		await expect(statusSelect.locator('option[value=""]')).toHaveText('Select...');

		// Check for options
		await expect(statusSelect.locator('option[value="draft"]')).toHaveText('Draft');
		await expect(statusSelect.locator('option[value="published"]')).toHaveText('Published');
		await expect(statusSelect.locator('option[value="archived"]')).toHaveText('Archived');
	});

	test('should have Create submit button', async ({ page }) => {
		const form = page.locator('.mcms-form');
		const submitButton = form.getByRole('button', { name: 'Create' });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel link', async ({ page }) => {
		const form = page.locator('.mcms-form');
		const cancelLink = form.getByRole('link', { name: 'Cancel' });
		await expect(cancelLink).toBeVisible();
	});

	test('should fill out form fields', async ({ page }) => {
		const form = page.locator('.mcms-form');

		// Fill title
		await form.locator('input#title').fill('Test Post Title');
		await expect(form.locator('input#title')).toHaveValue('Test Post Title');

		// Fill slug
		await form.locator('input#slug').fill('test-post-title');
		await expect(form.locator('input#slug')).toHaveValue('test-post-title');

		// Fill content
		await form.locator('textarea#content').fill('This is the test content.');
		await expect(form.locator('textarea#content')).toHaveValue('This is the test content.');

		// Select status
		await form.locator('select#status').selectOption('published');
		await expect(form.locator('select#status')).toHaveValue('published');

		// Check featured
		await form.locator('input#featured').check();
		await expect(form.locator('input#featured')).toBeChecked();
	});

	test('should show saving state when submitting form', async ({ page }) => {
		const form = page.locator('.mcms-form');

		// Fill required fields
		await form.locator('input#title').fill('Test Post');
		await form.locator('input#slug').fill('test-post');

		// Click submit
		const submitButton = form.getByRole('button', { name: 'Create' });
		await submitButton.click();

		// Should show "Saving..." state
		await expect(form.getByRole('button', { name: 'Saving...' })).toBeVisible();
	});
});

test.describe('Collection Create Form - Users', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/collections/users/create');
	});

	test('should display Create heading', async ({ page }) => {
		const mainContent = page.locator('.mcms-main');
		const heading = mainContent.getByRole('heading', { name: /Create User/i });
		await expect(heading).toBeVisible();
	});

	test('should display all Users fields', async ({ page }) => {
		const form = page.locator('.mcms-form');

		// Name field
		const nameLabel = form.getByText('Name');
		await expect(nameLabel).toBeVisible();
		const nameInput = form.locator('input#name');
		await expect(nameInput).toBeVisible();

		// Email field
		const emailLabel = form.getByText('Email');
		await expect(emailLabel).toBeVisible();
		const emailInput = form.locator('input#email');
		await expect(emailInput).toBeVisible();
		await expect(emailInput).toHaveAttribute('type', 'email');

		// Role field (select)
		const roleLabel = form.getByText('Role');
		await expect(roleLabel).toBeVisible();
		const roleSelect = form.locator('select#role');
		await expect(roleSelect).toBeVisible();

		// Active field (checkbox)
		const activeLabel = form.getByText('Active');
		await expect(activeLabel).toBeVisible();
		const activeCheckbox = form.locator('input#active');
		await expect(activeCheckbox).toBeVisible();
	});

	test('should have role select with correct options', async ({ page }) => {
		const form = page.locator('.mcms-form');
		const roleSelect = form.locator('select#role');

		await expect(roleSelect.locator('option[value="admin"]')).toHaveText('Admin');
		await expect(roleSelect.locator('option[value="editor"]')).toHaveText('Editor');
		await expect(roleSelect.locator('option[value="viewer"]')).toHaveText('Viewer');
	});

	test('should fill out user form fields', async ({ page }) => {
		const form = page.locator('.mcms-form');

		// Wait for form to be fully loaded
		await expect(form).toBeVisible();

		// Fill name - wait for input and click to focus
		const nameInput = form.locator('input#name');
		await expect(nameInput).toBeVisible();
		await nameInput.click();
		await nameInput.fill('John Doe');
		await expect(nameInput).toHaveValue('John Doe');

		// Fill email
		const emailInput = form.locator('input#email');
		await expect(emailInput).toBeVisible();
		await emailInput.click();
		await emailInput.fill('john@example.com');
		await expect(emailInput).toHaveValue('john@example.com');

		// Select role
		const roleSelect = form.locator('select#role');
		await roleSelect.selectOption('admin');
		await expect(roleSelect).toHaveValue('admin');

		// Check active
		const activeCheckbox = form.locator('input#active');
		await activeCheckbox.check();
		await expect(activeCheckbox).toBeChecked();
	});
});

test.describe('Collection Edit Form - Cancel Navigation', () => {
	test('should navigate back to list when clicking Cancel on Posts', async ({ page }) => {
		await page.goto('/admin/collections/posts/create');

		const form = page.locator('.mcms-form');
		const cancelLink = form.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should navigate back to list when clicking Cancel on Users', async ({ page }) => {
		await page.goto('/admin/collections/users/create');

		const form = page.locator('.mcms-form');
		const cancelLink = form.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(page).toHaveURL(/\/admin\/collections\/users$/);
	});
});

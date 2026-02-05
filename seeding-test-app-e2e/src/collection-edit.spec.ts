import { test, expect } from './fixtures/auth.fixture';

/**
 * Collection Edit/Create Form E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The seeding-test-app has: Categories, Articles, Users collections.
 *
 * Field IDs use pattern: field-{fieldName}
 */

test.describe('Collection Create Form - Articles', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Article/i });
		await expect(heading).toBeVisible();
	});

	test('should have breadcrumb navigation to list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Check breadcrumbs component exists and contains link to Articles list
		// Scope to breadcrumbs to avoid conflict with sidebar links
		const breadcrumbs = authenticatedPage.locator('mcms-breadcrumbs');
		await expect(breadcrumbs).toBeVisible();
		await expect(breadcrumbs.getByRole('link', { name: 'Articles' })).toBeVisible();
	});

	test('should navigate to list via breadcrumb', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Click the breadcrumb link (not the sidebar link)
		const breadcrumbs = authenticatedPage.locator('mcms-breadcrumbs');
		await breadcrumbs.getByRole('link', { name: 'Articles' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles$/);
	});

	test('should display Articles fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Title field
		const titleLabel = authenticatedPage.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = authenticatedPage.locator('input#field-title');
		await expect(titleInput).toBeVisible();

		// Content field (rich text editor - TipTap)
		const contentLabel = authenticatedPage.getByText('Content');
		await expect(contentLabel).toBeVisible();
		const richTextEditor = authenticatedPage.locator('[data-testid="rich-text-editor"]');
		await expect(richTextEditor).toBeVisible();
	});

	test('should have Create submit button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		const submitButton = authenticatedPage.getByRole('button', { name: 'Create' });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await expect(cancelButton).toBeVisible();
	});

	test('should fill out article form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Fill title
		await authenticatedPage.locator('input#field-title').fill('Test Article Title');
		await expect(authenticatedPage.locator('input#field-title')).toHaveValue('Test Article Title');

		// Fill content (rich text editor - TipTap/ProseMirror)
		const editor = authenticatedPage.locator('[data-testid="rich-text-editor"] .ProseMirror');
		await expect(editor).toBeVisible();
		await editor.click();
		await authenticatedPage.keyboard.type('This is the test article content.');
		await expect(editor).toContainText('This is the test article content.');
	});

	test('should successfully create a new article via API', async ({ authenticatedPage }) => {
		// Create article via API - more reliable than form interaction
		const timestamp = Date.now();
		const title = `E2E Test Article ${timestamp}`;

		const createResponse = await authenticatedPage.request.post('/api/articles', {
			data: {
				title,
				content: 'Content from E2E test',
			},
		});
		expect(createResponse.ok()).toBe(true);

		// Verify the article was created via API
		const response = await authenticatedPage.request.get(`/api/articles?limit=100`);
		const data = await response.json();
		const createdArticle = data.docs.find((doc: { title: string }) => doc.title === title);
		expect(createdArticle).toBeDefined();
	});
});

test.describe('Collection Create Form - Categories', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Category/i });
		await expect(heading).toBeVisible();
	});

	test('should display Categories fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Name field
		const nameLabel = authenticatedPage.getByText('Name');
		await expect(nameLabel).toBeVisible();
		const nameInput = authenticatedPage.locator('input#field-name');
		await expect(nameInput).toBeVisible();

		// Slug field
		const slugLabel = authenticatedPage.getByText('Slug');
		await expect(slugLabel).toBeVisible();
		const slugInput = authenticatedPage.locator('input#field-slug');
		await expect(slugInput).toBeVisible();
	});
});

test.describe('Collection Create Form - Users', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create User/i });
		await expect(heading).toBeVisible();
	});

	test('should display all Users fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Name field
		const nameLabel = authenticatedPage.getByText('Name');
		await expect(nameLabel).toBeVisible();
		const nameInput = authenticatedPage.locator('input#field-name');
		await expect(nameInput).toBeVisible();

		// Email field
		const emailLabel = authenticatedPage.getByText('Email');
		await expect(emailLabel).toBeVisible();
		const emailInput = authenticatedPage.locator('input#field-email');
		await expect(emailInput).toBeVisible();
		await expect(emailInput).toHaveAttribute('type', 'email');

		// Role field (select)
		const roleLabel = authenticatedPage.getByText('Role');
		await expect(roleLabel).toBeVisible();
		const roleSelect = authenticatedPage.locator('select#field-role');
		await expect(roleSelect).toBeVisible();

		// Active field (checkbox rendered as button with role="checkbox")
		const activeLabel = authenticatedPage.getByText('Active');
		await expect(activeLabel).toBeVisible();
		const activeCheckbox = authenticatedPage.getByRole('checkbox', { name: /Active/i });
		await expect(activeCheckbox).toBeVisible();
	});

	test('should have role select with correct options', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const roleSelect = authenticatedPage.locator('select#field-role');

		await expect(roleSelect.locator('option[value="admin"]')).toHaveText('Admin');
		await expect(roleSelect.locator('option[value="editor"]')).toHaveText('Editor');
		await expect(roleSelect.locator('option[value="viewer"]')).toHaveText('Viewer');
	});

	test('should fill out user form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Fill name
		const nameInput = authenticatedPage.locator('input#field-name');
		await expect(nameInput).toBeVisible();
		await nameInput.click();
		await nameInput.fill('John Doe');
		await expect(nameInput).toHaveValue('John Doe');

		// Fill email
		const emailInput = authenticatedPage.locator('input#field-email');
		await expect(emailInput).toBeVisible();
		await emailInput.click();
		await emailInput.fill('john@example.com');
		await expect(emailInput).toHaveValue('john@example.com');

		// Select role
		const roleSelect = authenticatedPage.locator('select#field-role');
		await roleSelect.selectOption('admin');
		await expect(roleSelect).toHaveValue('admin');

		// Check active (click the checkbox button)
		const activeCheckbox = authenticatedPage.getByRole('checkbox', { name: /Active/i });
		await activeCheckbox.click();
		await expect(activeCheckbox).toHaveAttribute('aria-checked', 'true');
	});
});

test.describe('Collection Edit Form - Cancel Navigation', () => {
	test('should navigate back to list when clicking Cancel on Articles', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('networkidle');

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles$/);
	});

	test('should navigate back to list when clicking Cancel on Users', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/users/new');
		await authenticatedPage.waitForLoadState('networkidle');

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users$/);
	});
});

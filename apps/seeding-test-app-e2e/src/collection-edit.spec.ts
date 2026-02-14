import { test, expect } from './fixtures';

/**
 * Collection Edit/Create Form E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The seeding-test-app has: Categories, Articles, and other collections.
 * Auth collections (Users as auth-user) are injected by the auth plugin.
 *
 * Field IDs use pattern: field-{fieldName}
 */

test.describe('Collection Create Form - Articles', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Article/i });
		await expect(heading).toBeVisible();
	});

	test('should have breadcrumb navigation to list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Check breadcrumbs component exists and contains link to Articles list
		// Scope to breadcrumbs to avoid conflict with sidebar links
		const breadcrumbs = authenticatedPage.locator('mcms-breadcrumbs');
		await expect(breadcrumbs).toBeVisible();
		await expect(breadcrumbs.getByRole('link', { name: 'Articles' })).toBeVisible();
	});

	test('should navigate to list via breadcrumb', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Click the breadcrumb link (not the sidebar link)
		const breadcrumbs = authenticatedPage.locator('mcms-breadcrumbs');
		await breadcrumbs.getByRole('link', { name: 'Articles' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles$/);
	});

	test('should display Articles fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Title field
		const titleLabel = authenticatedPage.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = authenticatedPage.locator('input#field-title');
		await expect(titleInput).toBeVisible();

		// Content field (rich text editor - TipTap)
		// Scope to main area to avoid matching sidebar "Content" group header
		const contentLabel = authenticatedPage.getByRole('main').getByText('Content');
		await expect(contentLabel).toBeVisible();
		const richTextEditor = authenticatedPage.locator('[data-testid="rich-text-editor"]');
		await expect(richTextEditor).toBeVisible();
	});

	test('should have Create submit button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const submitButton = authenticatedPage.getByRole('button', { name: 'Create', exact: true });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await expect(cancelButton).toBeVisible();
	});

	test('should fill out article form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

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
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Category/i });
		await expect(heading).toBeVisible();
	});

	test('should display Categories fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

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

test.describe('Collection Edit Form - Auth User', () => {
	test('should display create form with expected fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for form to render
		await expect(authenticatedPage.getByRole('heading', { name: /Create User/i })).toBeVisible({
			timeout: 10000,
		});

		// Verify expected fields are present
		await expect(authenticatedPage.locator('input#field-name')).toBeVisible();
		await expect(authenticatedPage.locator('input#field-email')).toBeVisible();

		// Create and Cancel buttons should be present
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'Cancel' })).toBeVisible();
	});
});

test.describe('Collection Edit Form - Cancel Navigation', () => {
	test('should navigate back to list when clicking Cancel on Articles', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for Angular hydration so event handlers are bound
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles$/, {
			timeout: 10000,
		});
	});

	test('should navigate back to list when clicking Cancel on Users', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/auth-user/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for Angular hydration so event handlers are bound
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user$/, {
			timeout: 10000,
		});
	});
});

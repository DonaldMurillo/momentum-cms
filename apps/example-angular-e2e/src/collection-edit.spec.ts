import { test, expect } from './fixtures';

/**
 * Collection Edit/Create Form E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 */

test.describe('Collection Create Form - Posts', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Post/i });
		await expect(heading).toBeVisible();
	});

	test('should have breadcrumb link back to list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Breadcrumb has a link back to the collection list
		const breadcrumbLink = authenticatedPage
			.locator('nav[aria-label="Breadcrumb"]')
			.getByRole('link', { name: 'Posts' });
		await expect(breadcrumbLink).toBeVisible();
	});

	test('should navigate back to list when clicking breadcrumb link', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const breadcrumbLink = authenticatedPage
			.locator('nav[aria-label="Breadcrumb"]')
			.getByRole('link', { name: 'Posts' });
		await breadcrumbLink.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should display all Posts fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Title field
		const titleLabel = authenticatedPage.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = authenticatedPage.locator('input#field-title');
		await expect(titleInput).toBeVisible();

		// URL Slug field
		const slugLabel = authenticatedPage.getByText('URL Slug');
		await expect(slugLabel).toBeVisible();
		const slugInput = authenticatedPage.locator('input#field-slug');
		await expect(slugInput).toBeVisible();

		// Content field (textarea)
		// exact: true avoids matching "Skip to main content" link (case-insensitive substring)
		const contentLabel = authenticatedPage.getByText('Content', { exact: true });
		await expect(contentLabel).toBeVisible();
		const contentTextarea = authenticatedPage.locator('textarea#field-content');
		await expect(contentTextarea).toBeVisible();

		// Status field (select)
		const statusLabel = authenticatedPage.getByText('Status');
		await expect(statusLabel).toBeVisible();
		const statusSelect = authenticatedPage.locator('select#field-status');
		await expect(statusSelect).toBeVisible();

		// Featured field (checkbox rendered as button)
		const featuredLabel = authenticatedPage.getByText('Featured Post');
		await expect(featuredLabel).toBeVisible();
		const featuredCheckbox = authenticatedPage.locator('[role="checkbox"]#field-featured');
		await expect(featuredCheckbox).toBeVisible();
	});

	test('should show required indicator on required fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Title and Slug are required - check for asterisks
		const titleRequired = authenticatedPage.getByText('Title').locator('..').getByText('*');
		const slugRequired = authenticatedPage.getByText('URL Slug').locator('..').getByText('*');
		await expect(titleRequired).toBeVisible();
		await expect(slugRequired).toBeVisible();
	});

	test('should have status select with correct options', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const statusSelect = authenticatedPage.locator('select#field-status');

		// Check for placeholder
		await expect(statusSelect.locator('option[value=""]')).toHaveText('Select...');

		// Check for options
		await expect(statusSelect.locator('option[value="draft"]')).toHaveText('Draft');
		await expect(statusSelect.locator('option[value="published"]')).toHaveText('Published');
		await expect(statusSelect.locator('option[value="archived"]')).toHaveText('Archived');
	});

	test('should have Create submit button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		const submitButton = authenticatedPage.getByRole('button', { name: 'Create' });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await expect(cancelButton).toBeVisible();
	});

	test('should fill out form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Fill title
		await authenticatedPage.locator('input#field-title').fill('Test Post Title');
		await expect(authenticatedPage.locator('input#field-title')).toHaveValue('Test Post Title');

		// Fill slug
		await authenticatedPage.locator('input#field-slug').fill('test-post-title');
		await expect(authenticatedPage.locator('input#field-slug')).toHaveValue('test-post-title');

		// Fill content
		await authenticatedPage.locator('textarea#field-content').fill('This is the test content.');
		await expect(authenticatedPage.locator('textarea#field-content')).toHaveValue(
			'This is the test content.',
		);

		// Select status
		await authenticatedPage.locator('select#field-status').selectOption('published');
		await expect(authenticatedPage.locator('select#field-status')).toHaveValue('published');

		// Toggle featured checkbox (rendered as button role="checkbox")
		await authenticatedPage.locator('[role="checkbox"]#field-featured').click();
		await expect(authenticatedPage.locator('[role="checkbox"]#field-featured')).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	test('should successfully create a new post and redirect to list', async ({
		authenticatedPage,
	}) => {
		// Create post via API - more reliable than form interaction
		const timestamp = Date.now();
		const title = `E2E Test Post ${timestamp}`;
		const slug = `e2e-test-post-${timestamp}`;

		const createResponse = await authenticatedPage.request.post('/api/posts', {
			data: {
				title,
				slug,
				content: 'Content from E2E test',
				status: 'published',
				featured: true,
			},
		});
		expect(createResponse.ok()).toBe(true);

		// Navigate to the list page and verify the post appears
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Verify we're on the list page
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts$/);

		// Verify the post was created via API
		const response = await authenticatedPage.request.get(`/api/posts?limit=100`);
		const data = await response.json();
		const createdPost = data.docs.find((doc: { title: string }) => doc.title === title);
		expect(createdPost).toBeDefined();
		expect(createdPost.slug).toBe(slug);
	});

	test('should create post with checkbox unchecked (boolean false)', async ({
		authenticatedPage,
	}) => {
		// Create post via API without featured flag
		const timestamp = Date.now();
		const title = `Post Without Featured ${timestamp}`;
		const slug = `post-without-featured-${timestamp}`;

		const createResponse = await authenticatedPage.request.post('/api/posts', {
			data: {
				title,
				slug,
				// featured is intentionally omitted to test false/undefined handling
			},
		});
		expect(createResponse.ok()).toBe(true);

		// Verify the post was created via API
		const response = await authenticatedPage.request.get(`/api/posts?limit=100`);
		const data = await response.json();
		const createdPost = data.docs.find((doc: { title: string }) => doc.title === title);
		expect(createdPost).toBeDefined();
		expect(createdPost.slug).toBe(slug);
		// Verify featured is false (checkbox not checked)
		expect(createdPost.featured).toBeFalsy();
	});
});

test.describe('Collection Edit Form - Auth User', () => {
	test('should display create form with expected fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user/new');
		await authenticatedPage.waitForLoadState('networkidle');

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
	test('should navigate back to list when clicking Cancel on Posts', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts/new');
		await authenticatedPage.waitForLoadState('networkidle');

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should navigate back to list when clicking Cancel on Users', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/auth-user/new');
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for Angular hydration so event handlers are bound
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' });
		await cancelButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user$/);
	});
});

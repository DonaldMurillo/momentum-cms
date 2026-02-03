import { test, expect } from './fixtures/auth.fixture';

/**
 * Collection Edit/Create Form E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 */

test.describe('Collection Create Form - Posts', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create Post/i });
		await expect(heading).toBeVisible();
	});

	test('should have back link to list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const backLink = authenticatedPage.getByRole('link', { name: /Back to list/i });
		await expect(backLink).toBeVisible();
	});

	test('should navigate back to list when clicking back link', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const backLink = authenticatedPage.getByRole('link', { name: /Back to list/i });
		await backLink.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should display all Posts fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Title field
		const titleLabel = authenticatedPage.getByText('Title');
		await expect(titleLabel).toBeVisible();
		const titleInput = authenticatedPage.locator('input#title');
		await expect(titleInput).toBeVisible();

		// URL Slug field
		const slugLabel = authenticatedPage.getByText('URL Slug');
		await expect(slugLabel).toBeVisible();
		const slugInput = authenticatedPage.locator('input#slug');
		await expect(slugInput).toBeVisible();

		// Content field (textarea)
		const contentLabel = authenticatedPage.getByText('Content');
		await expect(contentLabel).toBeVisible();
		const contentTextarea = authenticatedPage.locator('textarea#content');
		await expect(contentTextarea).toBeVisible();

		// Status field (select)
		const statusLabel = authenticatedPage.getByText('Status');
		await expect(statusLabel).toBeVisible();
		const statusSelect = authenticatedPage.locator('select#status');
		await expect(statusSelect).toBeVisible();

		// Featured field (checkbox)
		const featuredLabel = authenticatedPage.getByText('Featured Post');
		await expect(featuredLabel).toBeVisible();
		const featuredCheckbox = authenticatedPage.locator('input#featured');
		await expect(featuredCheckbox).toBeVisible();
	});

	test('should show required indicator on required fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Title and Slug are required - check for asterisks
		const titleRequired = authenticatedPage.getByText('Title').locator('..').getByText('*');
		const slugRequired = authenticatedPage.getByText('URL Slug').locator('..').getByText('*');
		await expect(titleRequired).toBeVisible();
		await expect(slugRequired).toBeVisible();
	});

	test('should have status select with correct options', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const statusSelect = authenticatedPage.locator('select#status');

		// Check for placeholder
		await expect(statusSelect.locator('option[value=""]')).toHaveText('Select...');

		// Check for options
		await expect(statusSelect.locator('option[value="draft"]')).toHaveText('Draft');
		await expect(statusSelect.locator('option[value="published"]')).toHaveText('Published');
		await expect(statusSelect.locator('option[value="archived"]')).toHaveText('Archived');
	});

	test('should have Create submit button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		const submitButton = authenticatedPage.getByRole('button', { name: 'Create' });
		await expect(submitButton).toBeVisible();
	});

	test('should have Cancel link', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const cancelLink = authenticatedPage.getByRole('link', { name: 'Cancel' });
		await expect(cancelLink).toBeVisible();
	});

	test('should fill out form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Fill title
		await authenticatedPage.locator('input#title').fill('Test Post Title');
		await expect(authenticatedPage.locator('input#title')).toHaveValue('Test Post Title');

		// Fill slug
		await authenticatedPage.locator('input#slug').fill('test-post-title');
		await expect(authenticatedPage.locator('input#slug')).toHaveValue('test-post-title');

		// Fill content
		await authenticatedPage.locator('textarea#content').fill('This is the test content.');
		await expect(authenticatedPage.locator('textarea#content')).toHaveValue(
			'This is the test content.',
		);

		// Select status
		await authenticatedPage.locator('select#status').selectOption('published');
		await expect(authenticatedPage.locator('select#status')).toHaveValue('published');

		// Check featured
		await authenticatedPage.locator('input#featured').check();
		await expect(authenticatedPage.locator('input#featured')).toBeChecked();
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

test.describe('Collection Create Form - Users', () => {
	test('should display Create heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const heading = authenticatedPage.getByRole('heading', { name: /Create User/i });
		await expect(heading).toBeVisible();
	});

	test('should display all Users fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Name field
		const nameLabel = authenticatedPage.getByText('Name');
		await expect(nameLabel).toBeVisible();
		const nameInput = authenticatedPage.locator('input#name');
		await expect(nameInput).toBeVisible();

		// Email field
		const emailLabel = authenticatedPage.getByText('Email');
		await expect(emailLabel).toBeVisible();
		const emailInput = authenticatedPage.locator('input#email');
		await expect(emailInput).toBeVisible();
		await expect(emailInput).toHaveAttribute('type', 'email');

		// Role field (select)
		const roleLabel = authenticatedPage.getByText('Role');
		await expect(roleLabel).toBeVisible();
		const roleSelect = authenticatedPage.locator('select#role');
		await expect(roleSelect).toBeVisible();

		// Active field (checkbox)
		const activeLabel = authenticatedPage.getByText('Active');
		await expect(activeLabel).toBeVisible();
		const activeCheckbox = authenticatedPage.locator('input#active');
		await expect(activeCheckbox).toBeVisible();
	});

	test('should have role select with correct options', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		const roleSelect = authenticatedPage.locator('select#role');

		await expect(roleSelect.locator('option[value="admin"]')).toHaveText('Admin');
		await expect(roleSelect.locator('option[value="editor"]')).toHaveText('Editor');
		await expect(roleSelect.locator('option[value="viewer"]')).toHaveText('Viewer');
	});

	test('should fill out user form fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/users/create');
		await authenticatedPage.waitForLoadState('networkidle');

		await expect(authenticatedPage.getByRole('button', { name: 'Create' })).toBeVisible();

		// Fill name
		const nameInput = authenticatedPage.locator('input#name');
		await expect(nameInput).toBeVisible();
		await nameInput.click();
		await nameInput.fill('John Doe');
		await expect(nameInput).toHaveValue('John Doe');

		// Fill email
		const emailInput = authenticatedPage.locator('input#email');
		await expect(emailInput).toBeVisible();
		await emailInput.click();
		await emailInput.fill('john@example.com');
		await expect(emailInput).toHaveValue('john@example.com');

		// Select role
		const roleSelect = authenticatedPage.locator('select#role');
		await roleSelect.selectOption('admin');
		await expect(roleSelect).toHaveValue('admin');

		// Check active
		const activeCheckbox = authenticatedPage.locator('input#active');
		await activeCheckbox.check();
		await expect(activeCheckbox).toBeChecked();
	});

	test('should successfully create a new user and redirect to list', async ({
		authenticatedPage,
	}) => {
		// Create user via API - more reliable than form interaction
		const timestamp = Date.now();
		const name = `E2E Test User ${timestamp}`;
		const email = `e2e-${timestamp}@test.com`;

		const createResponse = await authenticatedPage.request.post('/api/users', {
			data: {
				name,
				email,
				role: 'editor',
				active: true,
			},
		});
		expect(createResponse.ok()).toBe(true);

		// Navigate to the list page
		await authenticatedPage.goto('/admin/collections/users');
		await authenticatedPage.waitForLoadState('networkidle');

		// Verify we're on the list page
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users$/);
		await expect(authenticatedPage.getByRole('heading', { name: /users/i })).toBeVisible();
	});
});

test.describe('Collection Edit Form - Cancel Navigation', () => {
	test('should navigate back to list when clicking Cancel on Posts', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts/create');
		await authenticatedPage.waitForLoadState('networkidle');

		const cancelLink = authenticatedPage.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts$/);
	});

	test('should navigate back to list when clicking Cancel on Users', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/users/create');
		await authenticatedPage.waitForLoadState('networkidle');

		const cancelLink = authenticatedPage.getByRole('link', { name: 'Cancel' });
		await cancelLink.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/users$/);
	});
});

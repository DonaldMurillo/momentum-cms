import { test, expect } from './fixtures';

/**
 * Collection List E2E Tests
 *
 * Tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 */

test.describe('Collection List Page - Posts', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Posts' });
		await expect(heading).toBeVisible();
	});

	test('should display collection heading as page title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// The entity list page has an H1 heading with the collection label
		const heading = authenticatedPage.locator('main').getByRole('heading', { name: 'Posts' });
		await expect(heading).toBeVisible();
	});

	test('should have Create Post button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Post/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate to create form when clicking Create Post', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create Post/i });
		await createButton.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts\/new/);
	});

	test('should display data table with column headers', async ({ authenticatedPage }) => {
		// Create a post so the table renders with headers (empty state shows "No items found")
		const timestamp = Date.now();
		const createResponse = await authenticatedPage.request.post('/api/posts', {
			data: {
				title: `Table Header Test ${timestamp}`,
				slug: `table-header-test-${timestamp}`,
			},
		});
		expect(createResponse.ok()).toBe(true);

		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Table header cells are sortable (role="button") in mcms-data-table
		const tableHeader = authenticatedPage.locator('mcms-table-header');
		await expect(tableHeader).toBeVisible();

		// Check for column header text within the table header row
		await expect(tableHeader.getByText('Title')).toBeVisible();
		await expect(tableHeader.getByText('URL Slug')).toBeVisible();
	});
});

test.describe('Collection List Page - Users', () => {
	test('should display collection heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should display collection heading as page title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user');
		await authenticatedPage.waitForLoadState('networkidle');

		const heading = authenticatedPage.locator('main').getByRole('heading', { name: 'Users' });
		await expect(heading).toBeVisible();
	});

	test('should show Create User button for admin', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-user');
		await authenticatedPage.waitForLoadState('networkidle');

		const createButton = authenticatedPage.getByRole('button', { name: /Create User/i });
		await expect(createButton).toBeVisible({ timeout: 10000 });
	});

	test('should load user data in table via sidebar navigation', async ({ authenticatedPage }) => {
		// Navigate via sidebar (client-side navigation) to avoid SSR hydration issues
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByLabel('Main navigation');
		await nav.getByRole('link', { name: 'Users' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});

		// Wait for table to render with actual data
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Verify the admin user email appears in the table
		const adminEmailCell = authenticatedPage
			.locator('mcms-table-cell')
			.filter({ hasText: 'admin@test.com' });
		await expect(adminEmailCell.first()).toBeVisible({ timeout: 10000 });

		// Verify count subtitle shows a number
		const subtitle = authenticatedPage.getByText(/\d+ Users?/i);
		await expect(subtitle).toBeVisible({ timeout: 15000 });
	});
});

test.describe('Collection List Page - Auth API Keys', () => {
	test('should navigate via sidebar and display heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByLabel('Main navigation');
		await nav.getByRole('link', { name: 'Auth Api Keys' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-api-keys/, {
			timeout: 10000,
		});

		const heading = authenticatedPage.getByRole('heading', { name: 'Auth Api Keys' });
		await expect(heading).toBeVisible();
	});

	test('should NOT show Create button (create access denied)', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-api-keys');
		await authenticatedPage.waitForLoadState('networkidle');

		// auth-api-keys has create: () => false — keys must be created via Generate API Key action
		const createButton = authenticatedPage.getByRole('link', { name: /Create/i });
		await expect(createButton).toHaveCount(0);
	});

	test('should show Generate API Key button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-api-keys');
		await authenticatedPage.waitForLoadState('networkidle');

		const generateButton = authenticatedPage.getByTestId('header-action-generate-key');
		await expect(generateButton).toBeVisible({ timeout: 10000 });
		await expect(generateButton).toHaveText('Generate API Key');
	});

	test('should generate an API key via dialog', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/auth-api-keys');
		await authenticatedPage.waitForLoadState('networkidle');

		// Click the Generate API Key button
		const generateButton = authenticatedPage.getByTestId('header-action-generate-key');
		await expect(generateButton).toBeVisible({ timeout: 10000 });
		await generateButton.click();

		// Dialog should appear
		const dialog = authenticatedPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Fill in the key name
		const nameInput = dialog.getByLabel('Key Name');
		await nameInput.fill('E2E Test Key');

		// Submit
		const submitButton = dialog.getByRole('button', { name: 'Generate' });
		await expect(submitButton).toBeEnabled({ timeout: 10000 });
		await submitButton.click();

		// Should show the generated key
		await expect(dialog.getByText(/^mcms_[0-9a-f]+/)).toBeVisible({ timeout: 10000 });
		await expect(dialog.getByText('This key will only be shown once')).toBeVisible();

		// Close the dialog
		const doneButton = dialog.getByRole('button', { name: 'Done' });
		await doneButton.click();
		await expect(dialog).toBeHidden();
	});
});

test.describe('Collection List Page - Navigation', () => {
	test('should maintain sidebar visibility on collection list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Sidebar should show branding as an h1 heading
		const brandingTitle = authenticatedPage.getByRole('heading', {
			name: 'Momentum CMS',
			level: 1,
		});
		await expect(brandingTitle).toBeVisible();
	});

	test('should be able to switch between collections via sidebar', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		const nav = authenticatedPage.getByRole('navigation');

		// Navigate to Users via sidebar
		await nav.getByRole('link', { name: 'Users' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();

		// Navigate back to Posts via sidebar
		await nav.getByRole('link', { name: 'Posts' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/posts/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});
});

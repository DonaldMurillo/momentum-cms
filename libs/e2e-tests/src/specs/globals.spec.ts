import { test, expect } from '../fixtures';

/**
 * Globals E2E Tests
 *
 * Tests the globals API endpoints against a real server with a real database.
 * The example app defines a "site-settings" global with:
 * - read: () => true (public)
 * - update: admin only
 *
 * Globals are singleton documents — one per slug, auto-created on first read.
 */

// ============================================
// Globals API - Basic Operations
// ============================================

test.describe('Globals API - Basic Operations', () => {
	test('GET /api/globals/:slug returns the global (auto-creates on first read)', async ({
		request,
	}) => {
		const response = await request.get('/api/globals/site-settings');
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.doc).toBeDefined();
		// Auto-created globals have empty data but include slug
		expect(data.doc).toHaveProperty('slug', 'site-settings');
	});

	test('GET /api/globals/nonexistent returns 404', async ({ request }) => {
		const response = await request.get('/api/globals/nonexistent');
		expect(response.status()).toBe(404);
	});

	test('PATCH /api/globals/:slug requires authentication', async ({ request }) => {
		const response = await request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'Unauthorized Update' },
		});
		// site-settings update requires admin role
		expect(response.status()).toBe(403);
	});
});

// ============================================
// Globals API - Authenticated Operations
// ============================================

test.describe('Globals API - Authenticated Operations', () => {
	test('admin can update a global', async ({ authenticatedPage }) => {
		const timestamp = Date.now();
		const response = await authenticatedPage.request.patch('/api/globals/site-settings', {
			data: {
				'site-name': `Test Site ${timestamp}`,
				description: 'E2E test description',
				'maintenance-mode': false,
			},
		});
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.doc).toBeDefined();
		expect(data.doc['site-name']).toBe(`Test Site ${timestamp}`);
		expect(data.doc.description).toBe('E2E test description');
		expect(data.doc['maintenance-mode']).toBe(false);
	});

	test('updated global data persists across reads', async ({ authenticatedPage }) => {
		const timestamp = Date.now();
		const siteName = `Persistent Site ${timestamp}`;

		// Update the global
		const updateResponse = await authenticatedPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': siteName },
		});
		expect(updateResponse.status()).toBe(200);

		// Read it back (public read — no auth needed, but use authenticated for consistency)
		const readResponse = await authenticatedPage.request.get('/api/globals/site-settings');
		expect(readResponse.status()).toBe(200);

		const data = await readResponse.json();
		expect(data.doc['site-name']).toBe(siteName);
	});

	test('multiple updates overwrite previous data', async ({ authenticatedPage }) => {
		// First update
		const firstResponse = await authenticatedPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'First Name', description: 'First description' },
		});
		expect(firstResponse.status()).toBe(200);

		// Second update - partial (only site-name)
		const secondResponse = await authenticatedPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'Second Name' },
		});
		expect(secondResponse.status()).toBe(200);

		// Verify the latest state
		const readResponse = await authenticatedPage.request.get('/api/globals/site-settings');
		expect(readResponse.status()).toBe(200);

		const data = await readResponse.json();
		expect(data.doc['site-name']).toBe('Second Name');
		// Verify partial PATCH merges with existing data (description unchanged)
		expect(data.doc.description).toBe('First description');
	});
});

// ============================================
// Globals API - Access Control
// ============================================

test.describe('Globals API - Access Control', () => {
	test('viewer cannot update globals (403)', async ({ viewerPage }) => {
		const response = await viewerPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'Viewer Attempt' },
		});
		expect(response.status()).toBe(403);

		// Verify data was NOT mutated
		const readResponse = await viewerPage.request.get('/api/globals/site-settings');
		const data = await readResponse.json();
		expect(data.doc['site-name']).not.toBe('Viewer Attempt');
	});

	test('editor cannot update globals (403)', async ({ editorPage }) => {
		const response = await editorPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'Editor Attempt' },
		});
		expect(response.status()).toBe(403);

		// Verify data was NOT mutated
		const readResponse = await editorPage.request.get('/api/globals/site-settings');
		const data = await readResponse.json();
		expect(data.doc['site-name']).not.toBe('Editor Attempt');
	});

	test('unauthenticated user can read globals (public read)', async ({ request }) => {
		const response = await request.get('/api/globals/site-settings');
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.doc).toBeDefined();
	});
});

// ============================================
// Globals Admin UI
// ============================================

test.describe('Globals Admin UI', () => {
	test('sidebar shows globals section with Site Settings link', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const sidebarNav = authenticatedPage.getByLabel('Main navigation');

		// Globals section heading should be visible
		await expect(sidebarNav.getByText('Globals')).toBeVisible();

		// Site Settings link should exist with correct href
		const settingsLink = sidebarNav.getByRole('link', { name: 'Site Settings' });
		await expect(settingsLink).toBeVisible();
		await expect(settingsLink).toHaveAttribute('href', '/admin/globals/site-settings');
	});

	test('clicking sidebar link navigates to global edit page', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		const sidebarNav = authenticatedPage.getByLabel('Main navigation');
		await sidebarNav.getByRole('link', { name: 'Site Settings' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/globals\/site-settings$/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Site Settings' })).toBeVisible();
	});

	test('global edit page displays expected fields', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/globals/site-settings');
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for form to render
		await expect(authenticatedPage.getByRole('heading', { name: 'Site Settings' })).toBeVisible();

		// Site Name field (text input, required)
		await expect(authenticatedPage.getByText('Site Name')).toBeVisible();
		await expect(authenticatedPage.locator('input#field-site-name')).toBeVisible();

		// Description field (textarea)
		await expect(authenticatedPage.getByText('Site Description')).toBeVisible();
		await expect(authenticatedPage.locator('textarea#field-description')).toBeVisible();

		// Maintenance Mode field (checkbox)
		await expect(authenticatedPage.getByText('Maintenance Mode')).toBeVisible();
		await expect(
			authenticatedPage.locator('[role="checkbox"]#field-maintenance-mode'),
		).toBeVisible();

		// Save Changes button (edit mode)
		await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible();
	});

	test('can save global form and data persists', async ({ authenticatedPage }) => {
		const timestamp = Date.now();
		const siteName = `UI Test Site ${timestamp}`;

		await authenticatedPage.goto('/admin/globals/site-settings');
		await authenticatedPage.waitForLoadState('networkidle');

		// Wait for form to be ready
		await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible();

		// Fill in the site name field
		const siteNameInput = authenticatedPage.locator('input#field-site-name');
		await siteNameInput.click();
		await siteNameInput.clear();
		await siteNameInput.fill(siteName);

		// Fill description
		const descriptionInput = authenticatedPage.locator('textarea#field-description');
		await descriptionInput.click();
		await descriptionInput.clear();
		await descriptionInput.fill('Saved from admin UI');

		// Click Save Changes
		await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();

		// Verify data persisted via API (avoids flaky UI reload assertions)
		await expect
			.poll(
				async () => {
					const response = await authenticatedPage.request.get('/api/globals/site-settings');
					const data = await response.json();
					return data.doc['site-name'];
				},
				{ timeout: 10000 },
			)
			.toBe(siteName);

		// Also verify description persisted
		const verifyResponse = await authenticatedPage.request.get('/api/globals/site-settings');
		const verifyData = await verifyResponse.json();
		expect(verifyData.doc.description).toBe('Saved from admin UI');
	});
});

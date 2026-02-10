import { test, expect } from './fixtures';

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
	});

	test('editor cannot update globals (403)', async ({ editorPage }) => {
		const response = await editorPage.request.patch('/api/globals/site-settings', {
			data: { 'site-name': 'Editor Attempt' },
		});
		expect(response.status()).toBe(403);
	});

	test('unauthenticated user can read globals (public read)', async ({ request }) => {
		const response = await request.get('/api/globals/site-settings');
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.doc).toBeDefined();
	});
});

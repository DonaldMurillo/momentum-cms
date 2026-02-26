import { test, expect } from '../fixtures';

/**
 * Access Control E2E Tests
 *
 * Tests the complete access control system including:
 * - Backend API access control (403 responses)
 * - Frontend collection filtering based on permissions
 * - Route guards and redirects
 * - Permission-based UI visibility
 *
 * Collections used:
 * - Categories: allowAll (public access)
 * - User Notes: requires authentication for all operations
 * - Auth Users: admin-only for all operations
 */

test.describe('Backend Access Control', { tag: ['@security', '@api'] }, () => {
	test.describe('Unauthenticated API Access', () => {
		test('GET /api/categories should allow unauthenticated read (public)', async ({ request }) => {
			const response = await request.get('/api/categories');
			// Categories collection has read: allowAll()
			expect(response.status()).toBe(200);
		});

		test('GET /api/user-notes should deny unauthenticated read', async ({ request }) => {
			const response = await request.get('/api/user-notes');
			// User Notes collection has read: ({ req }) => !!req.user
			expect(response.status()).toBe(403);
		});

		test('GET /api/auth-user should deny unauthenticated read', async ({ request }) => {
			const response = await request.get('/api/auth-user');
			// Users collection has read: admin only
			expect(response.status()).toBe(403);
		});

		test('POST /api/user-notes should deny unauthenticated create', async ({ request }) => {
			const response = await request.post('/api/user-notes', {
				data: {
					title: 'Test Note',
				},
			});
			// User Notes collection has create: ({ req }) => !!req.user
			expect(response.status()).toBe(403);
		});

		test('DELETE /api/user-notes/1 should deny unauthenticated delete', async ({ request }) => {
			const response = await request.delete('/api/user-notes/1');
			// User Notes collection has delete: ({ req }) => !!req.user
			expect(response.status()).toBe(403);
		});
	});

	test.describe('Collection Access Endpoint', () => {
		test('GET /api/access should return permissions for unauthenticated user', async ({
			request,
		}) => {
			const response = await request.get('/api/access');
			expect(response.status()).toBe(200);

			const data = await response.json();
			expect(data.collections).toBeDefined();
			expect(Array.isArray(data.collections)).toBe(true);

			// Find categories and user-notes collections
			const categories = data.collections.find((c: { slug: string }) => c.slug === 'categories');
			const userNotes = data.collections.find((c: { slug: string }) => c.slug === 'user-notes');
			const users = data.collections.find((c: { slug: string }) => c.slug === 'auth-user');

			expect(
				categories,
				'categories collection should exist in /api/access response',
			).toBeDefined();
			expect(categories.canRead).toBe(true); // public read

			expect(userNotes, 'user-notes collection should exist in /api/access response').toBeDefined();
			expect(userNotes.canRead).toBe(false); // requires auth

			expect(users, 'auth-user collection should exist in /api/access response').toBeDefined();
			expect(users.canAccess).toBe(false); // admin only
		});
	});
});

test.describe('Authenticated Access Control', { tag: ['@security', '@api'] }, () => {
	test.describe('API Access', () => {
		test('authenticated user can read user-notes', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.get('/api/user-notes');
			expect(response.status()).toBe(200);
			const data = await response.json();
			expect(data.docs).toBeDefined();
		});

		test('authenticated user can create user-notes', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.post('/api/user-notes', {
				data: {
					title: `E2E Test Note ${Date.now()}`,
				},
			});

			expect(response.status()).toBe(201);
			const data = await response.json();
			expect(data.doc).toBeDefined();
			expect(data.doc.title).toContain('E2E Test Note');
		});

		test('/api/access returns correct permissions for authenticated user', async ({
			authenticatedPage,
		}) => {
			const response = await authenticatedPage.request.get('/api/access');
			expect(response.status()).toBe(200);
			const data = await response.json();

			const userNotes = data.collections.find((c: { slug: string }) => c.slug === 'user-notes');

			// Admin user should have full access to user-notes
			expect(userNotes, 'user-notes collection should exist in /api/access response').toBeDefined();
			expect(userNotes.canAccess).toBe(true);
			expect(userNotes.canCreate).toBe(true);
			expect(userNotes.canRead).toBe(true);
			expect(userNotes.canUpdate).toBe(true);
			expect(userNotes.canDelete).toBe(true);
		});
	});
});

test.describe('Frontend Access Control', { tag: ['@security', '@admin'] }, () => {
	test('unauthenticated user redirected to login from protected route', async ({ page }) => {
		// Clear any cookies
		await page.context().clearCookies();

		// Try to access a protected collection route
		await page.goto('/admin/collections/categories');

		// Wait for SSR page to load, then Angular hydrates and auth guard redirects
		await page.waitForURL(/\/(login|setup)/, { timeout: 15000 });

		// Should be redirected to login or setup (depending on whether users exist)
		const url = page.url();
		expect(url).toMatch(/\/(login|setup)/);
	});

	test('unauthenticated user redirected to login from dashboard', async ({ page }) => {
		await page.context().clearCookies();
		await page.goto('/admin');

		// Wait for SSR page to load, then Angular hydrates and auth guard redirects
		await page.waitForURL(/\/(login|setup)/, { timeout: 15000 });

		const url = page.url();
		expect(url).toMatch(/\/(login|setup)/);
	});
});

test.describe('Authenticated Frontend Access Control', { tag: ['@security', '@admin'] }, () => {
	test('admin user sees collections in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Should see collections header
		const collectionsHeader = authenticatedPage.getByRole('heading', { name: /collections/i });
		await expect(collectionsHeader).toBeVisible();

		// Should see Categories collection link in sidebar
		const sidebar = authenticatedPage.locator('aside');
		const categoriesLink = sidebar.getByRole('link', { name: /categories/i });
		await expect(categoriesLink).toBeVisible();
	});

	test('can navigate to accessible collection', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Click on Categories collection link in sidebar
		const sidebar = authenticatedPage.locator('aside');
		const categoriesLink = sidebar.getByRole('link', { name: /categories/i });
		await categoriesLink.click();

		// Wait for navigation
		await authenticatedPage.waitForURL(/\/admin\/collections\/categories$/);

		// Should see the collection list page heading
		await expect(
			authenticatedPage.locator('main').getByRole('heading', { name: /categories/i }),
		).toBeVisible();
	});

	test('collection list page loads correctly', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('networkidle');

		// Should not be redirected away
		expect(authenticatedPage.url()).toContain('/collections/categories');

		// Should see the collection heading
		await expect(authenticatedPage.getByRole('heading', { name: /categories/i })).toBeVisible();
	});
});

test.describe('Access Control Edge Cases', { tag: ['@security', '@api'] }, () => {
	test('API returns proper error structure on access denied', async ({ request }) => {
		// Try to create a user-note without auth
		const response = await request.post('/api/user-notes', {
			data: {
				title: 'Unauthorized Note',
			},
		});

		expect(response.status()).toBe(403);

		const data = await response.json();
		expect(data.error).toBeDefined();
		expect(data.error).toContain('denied');
	});

	test('API returns 404 for non-existent collection, not 403', async ({ request }) => {
		const response = await request.get('/api/nonexistent');
		// Should be 404 (collection not found), not 403 (access denied)
		expect(response.status()).toBe(404);
	});
});

test.describe('Role-Based Access Control', { tag: ['@security', '@api'] }, () => {
	test.describe('Admin Role Permissions', () => {
		test('admin user can access users collection via API', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.get('/api/auth-user');
			// Admin should be able to read users
			expect(response.status()).toBe(200);
		});

		test('admin user has full permissions on user-notes', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.get('/api/access');
			const data = await response.json();
			const userNotes = data.collections.find((c: { slug: string }) => c.slug === 'user-notes');

			expect(userNotes?.canRead).toBe(true);
			expect(userNotes?.canCreate).toBe(true);
			expect(userNotes?.canUpdate).toBe(true);
			expect(userNotes?.canDelete).toBe(true);
		});
	});
});

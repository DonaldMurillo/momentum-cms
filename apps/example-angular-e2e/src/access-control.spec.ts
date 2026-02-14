import { test, expect } from './fixtures';

/**
 * Access Control E2E Tests
 *
 * Tests the complete access control system including:
 * - Backend API access control (403 responses)
 * - Frontend collection filtering based on permissions
 * - Route guards and redirects
 * - Permission-based UI visibility (create/delete buttons)
 *
 * IMPORTANT: These tests run against a real server with real access control.
 * The example app has two collections with different access rules:
 * - Posts: authenticated users can access, only admins can delete
 * - Users: only admins can access
 */

test.describe('Backend Access Control', () => {
	test.describe('Unauthenticated API Access', () => {
		test('GET /api/posts should allow unauthenticated read (public)', async ({ request }) => {
			const response = await request.get('/api/posts');
			// Posts collection has read: () => true (public)
			expect(response.status()).toBe(200);
		});

		test('GET /api/auth-user should deny unauthenticated read', async ({ request }) => {
			const response = await request.get('/api/auth-user');
			// Users collection has read: admin only
			expect(response.status()).toBe(403);
		});

		test('POST /api/posts should deny unauthenticated create', async ({ request }) => {
			const response = await request.post('/api/posts', {
				data: {
					title: 'Test Post',
					slug: 'test-post',
					content: 'This should fail',
					status: 'draft',
				},
			});
			// Posts collection has create: ({ req }) => !!req.user
			expect(response.status()).toBe(403);
		});

		test('DELETE /api/posts/1 should deny unauthenticated delete', async ({ request }) => {
			const response = await request.delete('/api/posts/1');
			// Posts collection has delete: admin only
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

			// Find posts and users collections
			const posts = data.collections.find((c: { slug: string }) => c.slug === 'posts');
			const users = data.collections.find((c: { slug: string }) => c.slug === 'auth-user');

			// Unauthenticated users shouldn't have admin access to any collection
			expect(posts, 'posts collection should exist in /api/access response').toBeDefined();
			expect(posts.canAccess).toBe(false); // admin requires auth
			expect(posts.canRead).toBe(true); // public read

			expect(users, 'auth-user collection should exist in /api/access response').toBeDefined();
			expect(users.canAccess).toBe(false); // admin only
		});
	});
});

test.describe('Authenticated Access Control', () => {
	test.describe('API Access', () => {
		test('authenticated user can create posts', async ({ authenticatedPage }) => {
			// Debug: Log cookies
			const cookies = await authenticatedPage.context().cookies();

			console.log(
				'[Test Debug] Cookies in context:',
				JSON.stringify(cookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path }))),
			);

			// Use the page's request context which automatically includes cookies
			const response = await authenticatedPage.request.post('/api/posts', {
				data: {
					title: 'E2E Test Post',
					slug: `e2e-test-post-${Date.now()}`,
					content: 'Created by E2E test',
					status: 'draft',
				},
			});

			console.log('[Test Debug] Response status:', response.status());

			expect(response.status()).toBe(201);
			const data = await response.json();
			expect(data.doc).toBeDefined();
			expect(data.doc.title).toBe('E2E Test Post');
		});

		test('authenticated user can read posts', async ({ authenticatedPage }) => {
			// Use the page's request context which automatically includes cookies
			const response = await authenticatedPage.request.get('/api/posts');

			expect(response.status()).toBe(200);
			const data = await response.json();
			expect(data.docs).toBeDefined();
		});

		test('/api/access returns correct permissions for authenticated user', async ({
			authenticatedPage,
		}) => {
			// Use the page's request context which automatically includes cookies
			const response = await authenticatedPage.request.get('/api/access');

			expect(response.status()).toBe(200);
			const data = await response.json();

			const posts = data.collections.find((c: { slug: string }) => c.slug === 'posts');

			// Admin user should have full access to posts
			expect(posts, 'posts collection should exist in /api/access response').toBeDefined();
			expect(posts.canAccess).toBe(true);
			expect(posts.canCreate).toBe(true);
			expect(posts.canRead).toBe(true);
			expect(posts.canUpdate).toBe(true);
			// canDelete depends on role - admin can delete, regular users cannot
		});
	});
});

test.describe('Frontend Access Control', () => {
	test('unauthenticated user redirected to login from protected route', async ({ page }) => {
		// Clear any cookies
		await page.context().clearCookies();

		// Try to access a protected collection route
		await page.goto('/admin/collections/posts');

		// Wait for SSR page to load, then Angular hydrates and auth guard redirects
		await page.waitForURL(/\/(login|setup)/, { timeout: 15000 });

		// Should be redirected to login or setup (depending on whether users exist)
		const url = page.url();
		expect(url.includes('/login') || url.includes('/setup')).toBeTruthy();
	});

	test('unauthenticated user redirected to login from dashboard', async ({ page }) => {
		await page.context().clearCookies();
		await page.goto('/admin');

		// Wait for SSR page to load, then Angular hydrates and auth guard redirects
		await page.waitForURL(/\/(login|setup)/, { timeout: 15000 });

		const url = page.url();
		expect(url.includes('/login') || url.includes('/setup')).toBeTruthy();
	});
});

test.describe('Authenticated Frontend Access Control', () => {
	test('admin user sees collections in sidebar', async ({ authenticatedPage }) => {
		// Navigate to dashboard
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Should see collections header
		const collectionsHeader = authenticatedPage.getByRole('heading', { name: /collections/i });
		await expect(collectionsHeader).toBeVisible();

		// Should see Posts collection link in sidebar (the sidebar is the aside element)
		const sidebar = authenticatedPage.locator('aside');
		const postsLink = sidebar.getByRole('link', { name: /posts/i });
		await expect(postsLink).toBeVisible();
	});

	test('can navigate to accessible collection', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('networkidle');

		// Click on Posts collection link in sidebar
		const sidebar = authenticatedPage.locator('aside');
		const postsLink = sidebar.getByRole('link', { name: /posts/i });
		await postsLink.click();

		// Wait for navigation
		await authenticatedPage.waitForURL(/\/admin\/collections\/posts$/);

		// Should see the collection list page heading
		await expect(
			authenticatedPage.locator('main').getByRole('heading', { name: /posts/i }),
		).toBeVisible();
	});

	test('collection list page loads correctly', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Should not be redirected away
		expect(authenticatedPage.url()).toContain('/collections/posts');

		// Should see the collection heading
		await expect(authenticatedPage.getByRole('heading', { name: /posts/i })).toBeVisible();
	});

	test('create button visible for authenticated users on posts', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/posts');
		await authenticatedPage.waitForLoadState('networkidle');

		// Create button should be visible (authenticated users can create posts)
		const createButton = authenticatedPage.getByRole('button', { name: /Create Post/i });
		await expect(createButton).toBeVisible();
	});
});

test.describe('Access Control Edge Cases', () => {
	test('API returns proper error structure on access denied', async ({ request }) => {
		// Try to create a post without auth
		const response = await request.post('/api/posts', {
			data: {
				title: 'Unauthorized Post',
				slug: 'unauthorized-post',
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

test.describe('Role-Based Access Control', () => {
	test.describe('Admin Role Permissions', () => {
		test('admin user can access users collection via API', async ({ authenticatedPage }) => {
			// The test user is admin (created by global setup)
			// Use the page's request context which automatically includes cookies
			const response = await authenticatedPage.request.get('/api/auth-user');

			// Admin should be able to read users
			expect(response.status()).toBe(200);
		});

		test('admin user has delete permission on posts', async ({ authenticatedPage }) => {
			// Use the page's request context which automatically includes cookies
			const response = await authenticatedPage.request.get('/api/access');

			const data = await response.json();
			const posts = data.collections.find((c: { slug: string }) => c.slug === 'posts');

			// Admin should have delete permission
			expect(posts?.canDelete).toBe(true);
		});
	});
});

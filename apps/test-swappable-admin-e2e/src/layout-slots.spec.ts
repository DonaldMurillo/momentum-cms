import { test, expect } from '../../../libs/e2e-tests/src/fixtures';

/**
 * Admin Layout Slots E2E Tests
 *
 * Comprehensive tests verifying every slot renders in the correct position.
 * Tests cover config-level, provider-level, and per-collection registration methods.
 */

test.describe('Shell Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render shell:header slot', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const shellHeader = authenticatedPage.locator('[data-testid="shell-header"]');
		await expect(shellHeader).toBeVisible({ timeout: 15000 });
		await expect(shellHeader).toContainText('shell:header');
	});

	test('should render shell:footer slot', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const shellFooter = authenticatedPage.locator('[data-testid="shell-footer"]');
		await expect(shellFooter).toBeVisible({ timeout: 15000 });
		await expect(shellFooter).toContainText('shell:footer');
	});

	test('should render shell:nav-start slot in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const navStart = authenticatedPage.locator('[data-testid="nav-start-widget"]');
		await expect(navStart).toBeVisible({ timeout: 15000 });
		await expect(navStart).toContainText('beforeNavigation');
	});

	test('should render shell:nav-end slot in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const navEnd = authenticatedPage.locator('[data-testid="nav-end-widget"]');
		await expect(navEnd).toBeVisible({ timeout: 15000 });
		await expect(navEnd).toContainText('shell:nav-end');
	});
});

test.describe('Dashboard Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render dashboard:before slot', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const banner = authenticatedPage.locator('[data-testid="dashboard-banner"]');
		await expect(banner).toBeVisible({ timeout: 15000 });
		await expect(banner).toContainText('beforeDashboard');
	});

	test('should render dashboard:after slot', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const footer = authenticatedPage.locator('[data-testid="dashboard-footer"]');
		await expect(footer).toBeVisible({ timeout: 15000 });
		await expect(footer).toContainText('dashboard:after');
	});

	test('should not render dashboard slots on non-dashboard pages', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the page to fully load by checking entity list is visible
		await expect(authenticatedPage.locator('mcms-entity-list')).toBeVisible({ timeout: 15000 });

		const dashboardBanner = authenticatedPage.locator('[data-testid="dashboard-banner"]');
		const dashboardFooter = authenticatedPage.locator('[data-testid="dashboard-footer"]');
		await expect(dashboardBanner).not.toBeVisible();
		await expect(dashboardFooter).not.toBeVisible();
	});
});

test.describe('Login Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render login:before and login:after slots on login page', async ({
		browser,
		baseURL,
	}) => {
		// Use a fresh context without auth to access the login page (guest guard redirects authenticated users)
		const context = await browser.newContext({ baseURL: baseURL ?? undefined });
		const page = await context.newPage();

		await page.goto('/admin/login');
		await page.waitForLoadState('domcontentloaded');

		const loginBefore = page.locator('[data-testid="login-before-banner"]');
		await expect(loginBefore).toBeVisible({ timeout: 15000 });
		await expect(loginBefore).toContainText('beforeLogin');

		const loginAfter = page.locator('[data-testid="login-after-links"]');
		await expect(loginAfter).toBeVisible({ timeout: 15000 });
		await expect(loginAfter).toContainText('afterLogin');

		await context.close();
	});
});

test.describe('Collection List Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render collection-list:after slot on all collection lists', async ({
		authenticatedPage,
	}) => {
		// Navigate to a non-overridden collection
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const listFooter = authenticatedPage.locator('[data-testid="list-footer"]');
		await expect(listFooter).toBeVisible({ timeout: 15000 });
		await expect(listFooter).toContainText('collection-list:after');
	});

	test('should render collection-list:before slot on collection lists', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const listBefore = authenticatedPage.locator('[data-testid="list-before-filter"]');
		await expect(listBefore).toBeVisible({ timeout: 15000 });
		await expect(listBefore).toContainText('beforeList');
	});
});

test.describe('Collection Edit Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render collection-edit:before slot on articles edit (per-collection)', async ({
		authenticatedPage,
	}) => {
		// Navigate to create new article to get to the edit page
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editBefore = authenticatedPage.locator('[data-testid="edit-before-warning"]');
		await expect(editBefore).toBeVisible({ timeout: 15000 });
		await expect(editBefore).toContainText('beforeEdit');
	});

	test('should render collection-edit:after slot on edit pages', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editAfter = authenticatedPage.locator('[data-testid="edit-after-related"]');
		await expect(editAfter).toBeVisible({ timeout: 15000 });
		await expect(editAfter).toContainText('collection-edit:after');
	});

	test('should render collection-edit:sidebar slot on articles edit (per-collection)', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.locator('[data-testid="edit-sidebar-meta"]');
		await expect(sidebar).toBeVisible({ timeout: 15000 });
		await expect(sidebar).toContainText('editSidebar');
	});

	test('should not render per-collection edit slots on other collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/categories/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the form to load
		await expect(authenticatedPage.locator('mcms-entity-form')).toBeVisible({ timeout: 15000 });

		// Per-collection slots for articles should NOT show on categories
		const editBefore = authenticatedPage.locator('[data-testid="edit-before-warning"]');
		await expect(editBefore).not.toBeVisible();

		// But the global edit:after slot should still show
		const editAfter = authenticatedPage.locator('[data-testid="edit-after-related"]');
		await expect(editAfter).toBeVisible();
	});
});

test.describe('Collection View Slots', { tag: ['@admin', '@swappable'] }, () => {
	test('should render view slots on article view page', async ({ authenticatedPage }) => {
		// Get an article ID via API
		const articlesResponse = await authenticatedPage.request.get(
			'/api/collections/articles?limit=1',
		);
		const articlesData = await articlesResponse.json();

		if (articlesData.docs?.length > 0) {
			const articleId = articlesData.docs[0].id;
			await authenticatedPage.goto(`/admin/collections/articles/${articleId}`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Per-collection + global before slot
			const viewBefore = authenticatedPage.locator('[data-testid="view-before-status"]');
			await expect(viewBefore).toBeVisible({ timeout: 15000 });
			await expect(viewBefore).toContainText('beforeView');

			// Global after slot
			const viewAfter = authenticatedPage.locator('[data-testid="view-after-related"]');
			await expect(viewAfter).toBeVisible({ timeout: 15000 });
			await expect(viewAfter).toContainText('collection-view:after');
		}
	});

	test('should render global view slots on non-articles collections', async ({
		authenticatedPage,
	}) => {
		// Get a category ID to navigate to its view
		const categoriesResponse = await authenticatedPage.request.get(
			'/api/collections/categories?limit=1',
		);
		const categoriesData = await categoriesResponse.json();

		if (categoriesData.docs?.length > 0) {
			const categoryId = categoriesData.docs[0].id;
			await authenticatedPage.goto(`/admin/collections/categories/${categoryId}`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Global view:before (registered via provider for all collections) should show
			const viewBefore = authenticatedPage.locator('[data-testid="view-before-status"]');
			await expect(viewBefore).toBeVisible({ timeout: 15000 });

			// Global view:after should show
			const viewAfter = authenticatedPage.locator('[data-testid="view-after-related"]');
			await expect(viewAfter).toBeVisible({ timeout: 15000 });
		}
	});
});

test.describe('All Slots Coexistence', { tag: ['@admin', '@swappable'] }, () => {
	test('should render all shell + dashboard slots together on dashboard', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// All these should coexist on the dashboard
		await expect(authenticatedPage.locator('[data-testid="shell-header"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="shell-footer"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="nav-start-widget"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="nav-end-widget"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="dashboard-banner"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="dashboard-footer"]')).toBeVisible({
			timeout: 15000,
		});
	});

	test('should render all edit slots together on articles edit', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Shell slots should persist across pages
		await expect(authenticatedPage.locator('[data-testid="shell-header"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="nav-start-widget"]')).toBeVisible({
			timeout: 15000,
		});

		// Edit-specific slots
		await expect(authenticatedPage.locator('[data-testid="edit-before-warning"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="edit-after-related"]')).toBeVisible({
			timeout: 15000,
		});
		await expect(authenticatedPage.locator('[data-testid="edit-sidebar-meta"]')).toBeVisible({
			timeout: 15000,
		});
	});
});

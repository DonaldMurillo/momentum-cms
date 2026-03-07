import { test, expect } from '../../../libs/e2e-tests/src/fixtures';

/**
 * Swappable Admin Pages E2E Tests
 *
 * Verifies that custom page components registered via provideAdminComponent()
 * replace the built-in defaults, and that the fallback chain works correctly.
 */
test.describe('Swappable Admin Pages', { tag: ['@admin', '@swappable'] }, () => {
	test('should render custom dashboard via provider override', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The custom dashboard should replace the built-in dashboard
		const customDashboard = authenticatedPage.locator('[data-testid="custom-dashboard"]');
		await expect(customDashboard).toBeVisible({ timeout: 15000 });
		await expect(customDashboard).toContainText('Custom Dashboard');
	});

	test('should render custom articles list via per-collection config override', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The custom articles list should replace the built-in collection list for articles
		const customArticlesList = authenticatedPage.locator('[data-testid="custom-articles-list"]');
		await expect(customArticlesList).toBeVisible({ timeout: 15000 });
		await expect(customArticlesList).toContainText('Custom Articles List');
	});

	test('should render built-in default for non-overridden collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/categories');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Categories should use the built-in list page (no override registered)
		const customArticlesList = authenticatedPage.locator('[data-testid="custom-articles-list"]');
		await expect(customArticlesList).not.toBeVisible({ timeout: 5000 });

		// The built-in entity list should be visible
		const entityList = authenticatedPage.locator('mcms-entity-list');
		await expect(entityList).toBeVisible({ timeout: 15000 });
	});
});

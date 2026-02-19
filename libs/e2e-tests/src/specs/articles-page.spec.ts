import { test, expect } from '../fixtures';

/**
 * Articles Page E2E Tests
 *
 * Verifies the articles listing page with search and category filtering.
 * Seeded articles: "Welcome Article" (no category), "First Tech Article" (Technology),
 * "Second Tech Article" (Technology), "Breaking News" (News),
 * "The Future of CMS Platforms" (News), "Getting Started with Angular 21" (Technology).
 */

test.describe('Articles Page', { tag: ['@frontend', '@articles'] }, () => {
	test('renders articles listing page with title', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-title"]')).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('[data-testid="articles-title"]')).toContainText('Articles');
	});

	test('displays seeded published articles', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// At least 6 seeded published articles should appear (other tests may add more)
		const cards = page.locator('[data-testid="article-card"]');
		await expect.poll(() => cards.count(), { timeout: 10000 }).toBeGreaterThanOrEqual(6);
	});

	test('search filters articles by title', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// Search for a specific article
		await page.locator('[data-testid="articles-search"]').fill('Angular');

		// Should filter to just the Angular article
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 5000 })
			.toBe(1);

		await expect(page.locator('[data-testid="article-title"]')).toContainText(
			'Getting Started with Angular 21',
		);
	});

	test('shows empty state when search has no results', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// Search for nonsense
		await page.locator('[data-testid="articles-search"]').fill('xyznonexistent12345');

		await expect(page.locator('[data-testid="articles-empty"]')).toBeVisible({
			timeout: 5000,
		});
		await expect(page.locator('[data-testid="articles-empty"]')).toContainText('No articles found');
	});

	test('category filter buttons are displayed', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// "All" button should be visible
		await expect(page.locator('[data-testid="category-all"]')).toBeVisible();

		// Category buttons for seeded categories
		await expect(page.locator('[data-testid="category-technology"]')).toBeVisible();
		await expect(page.locator('[data-testid="category-news"]')).toBeVisible();
	});

	test('category filter filters articles', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// Wait for all seeded articles to load before filtering
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBeGreaterThanOrEqual(6);

		const allCount = await page.locator('[data-testid="article-card"]').count();

		// Click Technology category -- should show at least 3 tech articles
		await page.locator('[data-testid="category-technology"]').click();

		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 5000 })
			.toBeGreaterThanOrEqual(3);

		// Verify the seeded technology articles are present
		const rawTitles = await page.locator('[data-testid="article-title"]').allTextContents();
		const titles = rawTitles.map((t) => t.trim());
		expect(titles).toContain('First Tech Article');
		expect(titles).toContain('Second Tech Article');
		expect(titles).toContain('Getting Started with Angular 21');

		// Click "All" to reset -- should restore original count
		await page.locator('[data-testid="category-all"]').click();

		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 5000 })
			.toBe(allCount);
	});

	test('articles show category badges with correct text', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({
			timeout: 10000,
		});

		// Category badges should show real category names
		const badges = page.locator('[data-testid="article-category"]');
		await expect(badges.first()).toBeVisible({ timeout: 5000 });
		const badgeTexts = await badges.allTextContents();
		const trimmed = badgeTexts.map((t) => t.trim());
		expect(trimmed).toContain('Technology');
		expect(trimmed).toContain('News');
	});

	test('app header and footer are present on articles page', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');

		await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="app-footer"]')).toBeVisible();
	});
});

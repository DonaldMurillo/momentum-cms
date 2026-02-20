import { test, expect } from '../fixtures';

/**
 * Articles Page E2E Tests
 *
 * Verifies the articles listing page with search and category filtering,
 * URL query param persistence, clickable article cards, and article detail page.
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

	test('search query is persisted in URL and survives page reload', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		// Wait for all articles to load before searching
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBeGreaterThanOrEqual(6);

		// Type search query character-by-character for reliable Angular [value] binding
		const searchInput = page.locator('[data-testid="articles-search"]');
		await searchInput.click();
		await searchInput.pressSequentially('Angular', { delay: 50 });

		// Wait for filter to apply
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBe(1);

		// Verify URL has search param
		await expect
			.poll(() => new URL(page.url()).searchParams.get('search'), { timeout: 5000 })
			.toBe('Angular');

		// Reload the page
		await page.reload();

		// Verify search input still has the query
		await expect(searchInput).toHaveValue('Angular', { timeout: 10000 });

		// Verify results are still filtered
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBe(1);
	});

	test('category filter is persisted in URL and survives page reload', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		// Wait for all articles to load
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBeGreaterThanOrEqual(6);

		// Click Technology category
		await page.locator('[data-testid="category-technology"]').click();

		// Wait for filter to apply
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 5000 })
			.toBeGreaterThanOrEqual(3);

		// Verify URL has category param
		await expect
			.poll(() => new URL(page.url()).searchParams.has('category'), { timeout: 3000 })
			.toBe(true);

		// Reload the page
		await page.reload();

		// Verify results are still filtered to tech articles after reload
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBeGreaterThanOrEqual(3);

		const titles = await page.locator('[data-testid="article-title"]').allTextContents();
		const trimmed = titles.map((t) => t.trim());
		expect(trimmed).toContain('First Tech Article');
	});

	test('every article card has a valid slug-based href', async ({ authenticatedPage: page }) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		// Wait for all seeded articles to load
		const cards = page.locator('[data-testid="article-card"]');
		await expect.poll(() => cards.count(), { timeout: 10000 }).toBeGreaterThanOrEqual(6);

		// Read every card's href attribute
		const hrefs: string[] = [];
		const count = await cards.count();
		for (let i = 0; i < count; i++) {
			const href = await cards.nth(i).getAttribute('href');
			expect(href, `Card ${i} must have an href attribute`).toBeTruthy();
			hrefs.push(href!);
		}

		// Every href must be /articles/<non-empty-slug> (at least 2 chars after /articles/)
		for (const href of hrefs) {
			expect(href, `href "${href}" must match /articles/<slug>`).toMatch(
				/^\/articles\/[a-z0-9][a-z0-9-]+$/,
			);
		}

		// No card should have an empty slug or UUID-based href
		for (const href of hrefs) {
			expect(href).not.toBe('/articles/');
			expect(href).not.toBe('/articles');
			expect(href).not.toMatch(
				/\/articles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		}

		// Known seeded slugs must be present
		const knownSlugs = [
			'/articles/welcome-article',
			'/articles/first-tech-article',
			'/articles/getting-started-with-angular-21',
			'/articles/breaking-news',
		];
		for (const slug of knownSlugs) {
			expect(hrefs, `Expected hrefs to include ${slug}`).toContain(slug);
		}
	});

	test('clicking article card navigates to slug URL and loads detail', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		// Wait for all articles to load
		await expect
			.poll(() => page.locator('[data-testid="article-card"]').count(), { timeout: 10000 })
			.toBeGreaterThanOrEqual(6);

		// Find the Angular 21 card
		const angularCard = page.locator('[data-testid="article-card"]', {
			has: page.locator('[data-testid="article-title"]', {
				hasText: 'Getting Started with Angular 21',
			}),
		});

		// Verify href BEFORE clicking
		await expect(angularCard).toHaveAttribute('href', '/articles/getting-started-with-angular-21');

		// Click the card
		await angularCard.click();

		// Verify URL is the slug URL
		await expect
			.poll(() => page.url(), { timeout: 10000 })
			.toContain('/articles/getting-started-with-angular-21');

		// Verify detail page loads with correct content
		await expect(page.locator('[data-testid="article-detail"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="article-detail-title"]')).toContainText(
			'Getting Started with Angular 21',
		);
		await expect(page.locator('[data-testid="article-detail-category"]')).toContainText(
			'Technology',
		);
	});

	test('direct navigation to slug URL loads correct article', async ({
		authenticatedPage: page,
	}) => {
		// Navigate directly to a different article by slug
		await page.goto('/articles/breaking-news');

		await expect(page.locator('[data-testid="article-detail"]')).toBeVisible({ timeout: 10000 });

		// Verify correct article loaded
		await expect(page.locator('[data-testid="article-detail-title"]')).toContainText(
			'Breaking News',
		);

		// Verify category badge
		await expect(page.locator('[data-testid="article-detail-category"]')).toContainText('News');

		// Verify content is rendered
		await expect(page.locator('[data-testid="article-detail-content"]')).toBeVisible();
	});

	test('article detail back link returns to articles listing', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-grid"]')).toBeVisible({ timeout: 10000 });

		// Click a card
		await page.locator('[data-testid="article-card"]').first().click();
		await expect(page.locator('[data-testid="article-detail"]')).toBeVisible({ timeout: 10000 });

		// Click back link
		await page.locator('[data-testid="article-back-link"]').click();

		// Should return to articles listing
		await expect(page.locator('[data-testid="articles-title"]')).toBeVisible({ timeout: 10000 });
		expect(page.url()).toMatch(/\/articles(\?.*)?$/);
	});

	test('article detail page shows error for non-existent slug', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles/non-existent-slug-12345');
		await expect(page.locator('[data-testid="article-error"]')).toBeVisible({ timeout: 10000 });
	});

	test('article detail page sets title and meta description', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles/getting-started-with-angular-21');
		await expect(page.locator('[data-testid="article-detail"]')).toBeVisible({ timeout: 10000 });

		// Verify <title> contains article title
		await expect
			.poll(() => page.title(), { timeout: 5000 })
			.toContain('Getting Started with Angular 21');

		// Verify meta description exists and has content
		const metaDesc = page.locator('meta[name="description"]');
		await expect(metaDesc).toHaveAttribute('content', /.+/, { timeout: 5000 });

		// Verify og:title
		const ogTitle = page.locator('meta[property="og:title"]');
		await expect(ogTitle).toHaveAttribute('content', /Getting Started with Angular 21/);

		// Verify og:type
		const ogType = page.locator('meta[property="og:type"]');
		await expect(ogType).toHaveAttribute('content', 'article');
	});

	test('articles listing page sets title and meta description', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/articles');
		await expect(page.locator('[data-testid="articles-title"]')).toBeVisible({ timeout: 10000 });

		// Verify <title> contains "Articles"
		await expect.poll(() => page.title(), { timeout: 5000 }).toContain('Articles');

		// Verify meta description
		const metaDesc = page.locator('meta[name="description"]');
		await expect(metaDesc).toHaveAttribute('content', /.+/, { timeout: 5000 });
	});
});

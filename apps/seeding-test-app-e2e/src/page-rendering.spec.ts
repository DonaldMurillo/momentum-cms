import { test, expect } from './fixtures';

/**
 * Page Rendering E2E Tests
 *
 * Verifies that frontend pages render block content from the CMS.
 * Seeded pages: "Home Page" (slug: home, 3 blocks), "About Page" (slug: about, 1 block),
 * "Empty Page" (slug: empty, 0 blocks).
 */

test.describe('Page Rendering', () => {
	test('renders home page at / with all seeded blocks', async ({ authenticatedPage: page }) => {
		await page.goto('/');

		// Wait for page content to load
		await expect(page.locator('[data-testid="page-content"]')).toBeVisible({ timeout: 10000 });

		// Hero block
		const heroHeading = page.locator('[data-testid="hero-heading"]');
		await expect(heroHeading).toBeVisible();
		await expect(heroHeading).toContainText('Welcome to Our Site');

		const heroSubheading = page.locator('[data-testid="hero-subheading"]');
		await expect(heroSubheading).toBeVisible();
		await expect(heroSubheading).toContainText('The best place for E2E testing');

		const heroCta = page.locator('[data-testid="hero-cta"]');
		await expect(heroCta).toBeVisible();
		await expect(heroCta).toContainText('Get Started');

		// Text block
		const textHeading = page.locator('[data-testid="text-heading"]');
		await expect(textHeading).toBeVisible();
		await expect(textHeading).toContainText('About Us');

		const textBody = page.locator('[data-testid="text-body"]');
		await expect(textBody).toContainText('test company that exists for E2E testing');

		// Feature block
		const featureTitle = page.locator('[data-testid="feature-title"]');
		await expect(featureTitle).toBeVisible();
		await expect(featureTitle).toContainText('Fast Testing');

		const featureDesc = page.locator('[data-testid="feature-description"]');
		await expect(featureDesc).toContainText('Run tests at lightning speed');
	});

	test('renders page by slug at /about', async ({ authenticatedPage: page }) => {
		await page.goto('/about');

		await expect(page.locator('[data-testid="page-content"]')).toBeVisible({ timeout: 10000 });

		// About page has one textBlock
		const textHeading = page.locator('[data-testid="text-heading"]');
		await expect(textHeading).toBeVisible();
		await expect(textHeading).toContainText('Our Story');

		const textBody = page.locator('[data-testid="text-body"]');
		await expect(textBody).toContainText('Founded in testing, built for reliability');

		// Should NOT have hero or feature blocks
		await expect(page.locator('[data-testid="hero-heading"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="feature-title"]')).not.toBeVisible();
	});

	test('renders empty state for page with no blocks', async ({ authenticatedPage: page }) => {
		await page.goto('/empty');

		await expect(page.locator('[data-testid="page-empty"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="page-empty"]')).toContainText(
			'This page has no content yet',
		);
	});

	test('shows 404 for non-existent slug', async ({ authenticatedPage: page }) => {
		await page.goto('/this-page-does-not-exist-' + Date.now());

		await expect(page.locator('[data-testid="page-error"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="page-error"]')).toContainText('Page not found');
	});

	test('SSR renders block content in initial HTML', async ({ request }) => {
		const response = await request.get('/');
		expect(response.ok()).toBe(true);

		const html = await response.text();
		// Verify SSR rendered the hero heading text in the raw HTML
		expect(html).toContain('Welcome to Our Site');
		expect(html).toContain('About Us');
		expect(html).toContain('Fast Testing');
	});
});

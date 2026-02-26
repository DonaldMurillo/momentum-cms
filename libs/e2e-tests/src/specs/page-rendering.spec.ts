import { test, expect } from '../fixtures';

/**
 * Page Rendering E2E Tests
 *
 * Verifies that frontend pages render block content from the CMS.
 * Seeded pages: "Home Page" (slug: home, 3 blocks), "About Page" (slug: about, 1 block),
 * "Empty Page" (slug: empty, 0 blocks), "Services Page" (slug: services, 4 blocks),
 * "Showcase Page" (slug: showcase, 4 blocks), "Contact Page" (slug: contact, 3 blocks).
 */

test.describe('Page Rendering', { tag: ['@frontend', '@blocks'] }, () => {
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
		await expect(page.locator('[data-testid="hero-heading"]')).toBeHidden();
		await expect(page.locator('[data-testid="feature-title"]')).toBeHidden();
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

	test('renders services page with new block types', async ({ authenticatedPage: page }) => {
		await page.goto('/services');

		await expect(page.locator('[data-testid="page-content"]')).toBeVisible({ timeout: 10000 });

		// Hero block
		await expect(page.locator('[data-testid="hero-heading"]')).toContainText('Our Services');

		// ImageText block
		await expect(page.locator('[data-testid="image-text-heading"]')).toContainText(
			'Custom Development',
		);
		await expect(page.locator('[data-testid="image-text-body"]')).toContainText(
			'tailor-made solutions',
		);

		// Stats block
		await expect(page.locator('[data-testid="stats-heading"]')).toContainText('By the Numbers');
		await expect(page.locator('[data-testid="stat-item"]')).toHaveCount(4);

		// CTA block
		await expect(page.locator('[data-testid="cta-heading"]')).toContainText('Ready to Get Started');
		await expect(page.locator('[data-testid="cta-primary-button"]')).toContainText('Contact Us');
		await expect(page.locator('[data-testid="cta-secondary-button"]')).toContainText(
			'View Portfolio',
		);
	});

	test('renders showcase page with testimonials and feature grid', async ({
		authenticatedPage: page,
	}) => {
		await page.goto('/showcase');

		await expect(page.locator('[data-testid="page-content"]')).toBeVisible({ timeout: 10000 });

		// Hero
		await expect(page.locator('[data-testid="hero-heading"]')).toContainText('Our Work');

		// Testimonials (2 on this page)
		const testimonials = page.locator('[data-testid="testimonial-quote"]');
		await expect(testimonials.first()).toBeVisible();
		await expect(testimonials).toHaveCount(2);

		// Feature grid
		await expect(page.locator('[data-testid="feature-grid-heading"]')).toContainText(
			'Why Choose Us',
		);
		await expect(page.locator('[data-testid="feature-grid-item"]')).toHaveCount(6);
	});

	test('renders contact page with text block and CTA', async ({ authenticatedPage: page }) => {
		await page.goto('/contact');

		await expect(page.locator('[data-testid="page-content"]')).toBeVisible({ timeout: 10000 });

		// Hero
		await expect(page.locator('[data-testid="hero-heading"]')).toContainText('Get in Touch');

		// Text block
		await expect(page.locator('[data-testid="text-heading"]')).toContainText('Contact Information');

		// CTA
		await expect(page.locator('[data-testid="cta-heading"]')).toContainText('Send Us a Message');
		await expect(page.locator('[data-testid="cta-primary-button"]')).toContainText('Open Admin');
	});

	test('app layout renders header and footer', async ({ authenticatedPage: page }) => {
		await page.goto('/');

		await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('[data-testid="app-footer"]')).toBeVisible();
		await expect(page.locator('[data-testid="app-logo"]')).toContainText('Momentum');
	});

	test('navigation links are visible in header', async ({ authenticatedPage: page }) => {
		await page.goto('/');

		await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 10000 });

		// Desktop nav links (visible on wide viewport)
		await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
		await expect(page.locator('[data-testid="nav-services"]')).toBeVisible();
		await expect(page.locator('[data-testid="nav-showcase"]')).toBeVisible();
		await expect(page.locator('[data-testid="nav-articles"]')).toBeVisible();
		await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
	});

	test('theme toggle is present and clickable', async ({ authenticatedPage: page }) => {
		await page.goto('/');

		const toggle = page.locator('[data-testid="theme-toggle"]');
		await expect(toggle).toBeVisible({ timeout: 10000 });

		// Get initial state
		const initialClass = await page.locator('html').getAttribute('class');

		// Click theme toggle
		await toggle.click();

		// Verify class changed (dark added or removed)
		await expect
			.poll(() => page.locator('html').getAttribute('class'), { timeout: 5000 })
			.not.toBe(initialClass);
	});
});

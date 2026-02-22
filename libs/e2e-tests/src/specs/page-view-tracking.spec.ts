import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Page View Tracking E2E Tests
 *
 * Verifies the full page-view tracking pipeline:
 * 1. Navigating to a seeded page creates a page_view event (with content attribution)
 * 2. Page view events appear in the Analytics Dashboard
 * 3. Page view events appear in the Content Performance page
 * 4. Category filter queries the server (not client-side only)
 * 5. Filter state (range, category) persists in URL query params across refresh
 */

test.describe('Page View Tracking', { tag: ['@analytics'] }, () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as admin
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok(), 'Admin sign-in must succeed').toBe(true);

		// Clear analytics events
		const clear = await request.delete('/api/test-analytics-events');
		expect(clear.ok()).toBe(true);
	});

	test('navigating to a seeded page creates a page_view event with content attribution', async ({
		page,
		request,
	}) => {
		// Visit the "about" page (seeded with slug: 'about')
		await page.goto('/about');
		await expect(page.getByText('Our Story')).toBeVisible({ timeout: 15000 });

		// Flush events and retrieve them via the test endpoint
		const eventsRes = await request.get('/api/test-analytics-events');
		expect(eventsRes.ok()).toBe(true);

		const body = (await eventsRes.json()) as {
			events: Array<{
				name: string;
				category: string;
				context: { url?: string; collection?: string };
				properties: Record<string, unknown>;
			}>;
		};

		// Find page_view events for /about
		const pageViews = body.events.filter(
			(e) => e.name === 'page_view' && e.context.url?.includes('/about'),
		);
		expect(pageViews.length).toBeGreaterThanOrEqual(1);

		// Verify content attribution — the event should have collection and slug metadata
		const aboutView = pageViews[0];
		expect(aboutView.properties['collection']).toBe('pages');
		expect(aboutView.properties['slug']).toBe('about');
	});

	test('navigating to an article creates a page_view with article content attribution', async ({
		page,
		request,
	}) => {
		// Visit a seeded article
		await page.goto('/articles/welcome-article');
		// Use heading role to avoid matching multiple elements with same text
		await expect(page.getByRole('heading', { name: 'Welcome Article' })).toBeVisible({
			timeout: 15000,
		});

		// Flush events and retrieve them
		const eventsRes = await request.get('/api/test-analytics-events');
		expect(eventsRes.ok()).toBe(true);

		const body = (await eventsRes.json()) as {
			events: Array<{
				name: string;
				context: { url?: string };
				properties: Record<string, unknown>;
			}>;
		};

		// Find page_view events for the article
		const pageViews = body.events.filter(
			(e) => e.name === 'page_view' && e.context.url?.includes('/articles/welcome-article'),
		);
		expect(pageViews.length).toBeGreaterThanOrEqual(1);

		// Verify article content attribution
		const articleView = pageViews[0];
		expect(articleView.properties['collection']).toBe('articles');
		expect(articleView.properties['slug']).toBe('welcome-article');
	});

	test('SPA navigation from articles listing to article detail tracks page_view', async ({
		page,
		request,
	}) => {
		// 1. Navigate to the articles listing page (SSR load)
		await page.goto('/articles');
		await expect(page.getByTestId('articles-title')).toBeVisible({ timeout: 15000 });

		// 2. Clear all events so we only see SPA navigation events
		const clear = await request.delete('/api/test-analytics-events');
		expect(clear.ok()).toBe(true);

		// 3. Click on the "Welcome Article" card (SPA navigation via Angular Router)
		const articleCard = page.getByTestId('article-card').filter({
			has: page.getByTestId('article-title').getByText('Welcome Article'),
		});
		await articleCard.click();

		// 4. Wait for the article detail page to render
		await expect(page.getByRole('heading', { name: 'Welcome Article' })).toBeVisible({
			timeout: 15000,
		});

		// 5. Poll for the page_view event created by the Angular PageViewTrackerService
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const body = (await res.json()) as {
						events: Array<{
							name: string;
							context: { url?: string };
							properties: Record<string, unknown>;
						}>;
					};
					return body.events.filter(
						(e) => e.name === 'page_view' && e.properties['path'] === '/articles/welcome-article',
					);
				},
				{
					timeout: 10000,
					message: 'SPA navigation should create a page_view event for /articles/welcome-article',
				},
			)
			.toHaveLength(1);

		// 6. Verify content attribution on the SPA-tracked event
		const eventsRes = await request.get('/api/test-analytics-events');
		const body = (await eventsRes.json()) as {
			events: Array<{
				name: string;
				properties: Record<string, unknown>;
			}>;
		};
		const spaEvent = body.events.find(
			(e) => e.name === 'page_view' && e.properties['path'] === '/articles/welcome-article',
		);
		expect(spaEvent).toBeDefined();
		expect(spaEvent!.properties['collection']).toBe('articles');
		expect(spaEvent!.properties['slug']).toBe('welcome-article');
	});

	test('SPA navigation between pages via header nav tracks page_views', async ({
		page,
		request,
	}) => {
		// 1. Navigate to home page (SSR load)
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');

		// 2. Clear all events
		const clear = await request.delete('/api/test-analytics-events');
		expect(clear.ok()).toBe(true);

		// 3. Click "About" in the header nav (SPA navigation)
		await page.getByTestId('nav-about').click();
		await expect(page.getByText('Our Story')).toBeVisible({ timeout: 15000 });

		// 4. Click "Articles" in the header nav (another SPA navigation)
		await page.getByTestId('nav-articles').click();
		await expect(page.getByTestId('articles-title')).toBeVisible({ timeout: 15000 });

		// 5. Poll for both page_view events
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const body = (await res.json()) as {
						events: Array<{
							name: string;
							properties: Record<string, unknown>;
						}>;
					};
					return body.events.filter((e) => e.name === 'page_view').length;
				},
				{
					timeout: 10000,
					message: 'Two SPA navigations should create two page_view events',
				},
			)
			.toBeGreaterThanOrEqual(2);

		// 6. Verify the /about event has content attribution
		const eventsRes = await request.get('/api/test-analytics-events');
		const body = (await eventsRes.json()) as {
			events: Array<{
				name: string;
				properties: Record<string, unknown>;
			}>;
		};
		const aboutEvent = body.events.find(
			(e) => e.name === 'page_view' && e.properties['path'] === '/about',
		);
		expect(aboutEvent).toBeDefined();
		expect(aboutEvent!.properties['collection']).toBe('pages');
		expect(aboutEvent!.properties['slug']).toBe('about');

		// The /articles event should also exist (articles listing, no slug match)
		const articlesEvent = body.events.find(
			(e) => e.name === 'page_view' && e.properties['path'] === '/articles',
		);
		expect(articlesEvent).toBeDefined();
	});

	test('page views appear in analytics dashboard recent activity', async ({
		authenticatedPage,
		request,
	}) => {
		// Seed a page_view event via the collect API
		const events = [
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-1',
				sessionId: 'session-1',
				context: { url: 'http://localhost/about', source: 'server' },
			},
		];
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);

		// Navigate to admin analytics dashboard
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the recent activity table to render
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// The seeded page_view may be buried under API tracking events from the fixture.
		// Use the search to find it specifically.
		const searchInput = authenticatedPage.getByLabel('Search analytics events');
		await searchInput.fill('/about');

		// The /about page should now be visible in the filtered results
		await expect(authenticatedPage.getByText('/about', { exact: false })).toBeVisible({
			timeout: 10000,
		});
	});

	test('page views appear in content performance page', async ({ authenticatedPage, request }) => {
		// Seed page_view events
		const events = [
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-1',
				sessionId: 'session-1',
				context: { url: 'http://localhost/about', source: 'server' },
			},
		];
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);

		// Navigate to content performance page
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for table to render
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// The /about page should appear in the top pages table
		await expect(authenticatedPage.getByText('/about')).toBeVisible({ timeout: 10000 });
	});

	test('category filter queries server with category param', async ({
		authenticatedPage,
		request,
	}) => {
		// Seed events with different categories
		const events = [
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'v-1',
				sessionId: 's-1',
				context: { url: 'http://localhost/home' },
			},
			{
				name: 'content_created',
				category: 'content',
				visitorId: 'v-2',
				sessionId: 's-2',
				context: { url: '/api/articles', collection: 'articles', operation: 'create' },
			},
		];
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);

		// Navigate to dashboard
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Scope category filter buttons to the filter row (the one containing "Content", "API", "Page")
		const categoryFilterRow = authenticatedPage.locator('.flex.gap-2').filter({
			has: authenticatedPage.getByRole('button', { name: 'Content' }),
		});
		// Click the "Page" category filter button
		await categoryFilterRow.getByRole('button', { name: 'Page' }).click();

		// After clicking "Page", only page-category events should be shown.
		// The /home page_view event should be visible in the table.
		const table = authenticatedPage.getByRole('table');
		await expect(table.getByText('/home', { exact: false })).toBeVisible({
			timeout: 10000,
		});

		// The content_created event should NOT appear in the table.
		// Scope the assertion to the table to avoid matching overview cards.
		await expect(table.getByText('Content Created')).not.toBeVisible();
	});

	test('dashboard filter state persists in URL on refresh', async ({
		authenticatedPage,
		request,
	}) => {
		// Seed some events
		const events = [
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'v-1',
				sessionId: 's-1',
				context: { url: 'http://localhost/home' },
			},
		];
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);

		// Navigate to analytics dashboard
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Select "24h" date range
		await authenticatedPage.getByRole('button', { name: '24h' }).click();

		// Scope to category filter row and select "Page" category
		const categoryFilterRow = authenticatedPage.locator('.flex.gap-2').filter({
			has: authenticatedPage.getByRole('button', { name: 'Content' }),
		});
		await categoryFilterRow.getByRole('button', { name: 'Page' }).click();

		// URL should contain query params for the selected filters
		await expect
			.poll(() => authenticatedPage.url(), {
				timeout: 5000,
				message: 'URL should contain range=24h',
			})
			.toContain('range=24h');

		await expect
			.poll(() => authenticatedPage.url(), {
				timeout: 5000,
				message: 'URL should contain category=page',
			})
			.toContain('category=page');

		// Refresh the page
		await authenticatedPage.reload();
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// After refresh, 24h should still be the selected range
		const btn24h = authenticatedPage.getByRole('button', { name: '24h' });
		await expect(btn24h).toBeVisible({ timeout: 10000 });
		// The 24h button should have the "active" styling (bg-primary)
		await expect(btn24h).toHaveClass(/bg-primary/, { timeout: 5000 });

		// Page category filter should still be active after refresh
		const refreshedCategoryRow = authenticatedPage.locator('.flex.gap-2').filter({
			has: authenticatedPage.getByRole('button', { name: 'Content' }),
		});
		const btnPage = refreshedCategoryRow.getByRole('button', { name: 'Page' });
		await expect(btnPage).toHaveClass(/bg-primary/, { timeout: 5000 });
	});

	test('content performance URL state persists on refresh', async ({
		authenticatedPage,
		request,
	}) => {
		// Seed some page_view events
		const events = [
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'v-1',
				sessionId: 's-1',
				context: { url: 'http://localhost/home' },
			},
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'v-2',
				sessionId: 's-2',
				context: { url: 'http://localhost/about' },
			},
		];
		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);

		// Navigate to content performance page
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Select "7d" date range
		await authenticatedPage.getByRole('button', { name: '7d' }).click();

		// URL should contain range=7d
		await expect
			.poll(() => authenticatedPage.url(), {
				timeout: 5000,
				message: 'URL should contain range=7d',
			})
			.toContain('range=7d');

		// Refresh the page
		await authenticatedPage.reload();
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// After refresh, 7d should still be selected
		const btn7d = authenticatedPage.getByRole('button', { name: '7d' });
		await expect(btn7d).toBeVisible({ timeout: 10000 });
		await expect(btn7d).toHaveClass(/bg-primary/, { timeout: 5000 });
	});
});

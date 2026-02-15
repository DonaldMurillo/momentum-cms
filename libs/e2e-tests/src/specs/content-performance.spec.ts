import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Content Performance E2E Tests
 *
 * Verifies:
 * - Content performance page auto-loads top pages on navigation
 * - Summary cards show correct totals
 * - Date range selector works
 * - Search filters the table
 * - Row expansion shows referrer details
 */

test.describe('Content Performance', { tag: ['@analytics', '@api'] }, () => {
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

		// Seed page_view events with different URLs, visitors, and referrers
		const events = [
			// 3 page_views for /home (different visitors, one with google referrer)
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-1',
				sessionId: 'session-1',
				context: { url: 'http://localhost/home', referrer: 'https://google.com' },
			},
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-2',
				sessionId: 'session-2',
				context: { url: 'http://localhost/home' },
			},
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-3',
				sessionId: 'session-3',
				context: { url: 'http://localhost/home', referrer: 'https://twitter.com' },
			},
			// 2 page_views for /about (same visitor — should count as 1 unique)
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-1',
				sessionId: 'session-1',
				context: { url: 'http://localhost/about' },
			},
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-1',
				sessionId: 'session-1',
				context: { url: 'http://localhost/about' },
			},
			// 1 page_view for /products/laptop
			{
				name: 'page_view',
				category: 'page',
				visitorId: 'visitor-4',
				sessionId: 'session-4',
				context: {
					url: 'http://localhost/products/laptop',
					referrer: 'https://twitter.com',
				},
			},
		];

		const ingest = await request.post('/api/analytics/collect', {
			headers: { 'Content-Type': 'application/json' },
			data: { events },
		});
		expect(ingest.status()).toBe(202);
		const body = (await ingest.json()) as { accepted: number };
		expect(body.accepted).toBe(6);
	});

	test('content performance API returns page_view events', async ({ request }) => {
		const response = await request.get('/api/analytics/query?name=page_view&limit=1000');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			events: Array<{ name: string; context: { url?: string } }>;
			total: number;
		};

		expect(data.total).toBeGreaterThanOrEqual(6);
		const pageViewEvents = data.events.filter((e) => e.name === 'page_view');
		expect(pageViewEvents.length).toBeGreaterThanOrEqual(6);
	});

	test('page auto-loads top content on navigation', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Heading should be visible
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Content Performance' }),
		).toBeVisible({ timeout: 15000 });

		// Date range buttons
		await expect(authenticatedPage.getByRole('button', { name: '24h' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: '7d' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: '30d' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'All' })).toBeVisible();

		// Table should show pages ranked by views — /home should appear first (3 views)
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.getByText('/home')).toBeVisible();
	});

	test('summary cards show correct totals', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for data to load
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Total Views: 6 (3 + 2 + 1)
		await expect(authenticatedPage.getByText('Total Views')).toBeVisible();
		await expect(authenticatedPage.getByText('6', { exact: true })).toBeVisible();

		// Pages: 3 (/home, /about, /products/laptop)
		// Scope to main content to avoid matching sidebar "Pages" link
		const mainContent = authenticatedPage.locator('#mcms-main-content');
		await expect(mainContent.getByText('Pages')).toBeVisible();
		await expect(mainContent.getByText('3', { exact: true }).first()).toBeVisible();
	});

	test('date range selector filters data', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for initial load
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Click "24h" — events are recent, so data should still be present
		await authenticatedPage.getByRole('button', { name: '24h' }).click();
		await expect(authenticatedPage.getByText('/home')).toBeVisible({ timeout: 10000 });
	});

	test('search filters the table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for table
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Type "home" in search — only /home row should remain
		const searchInput = authenticatedPage.getByLabel('Search content pages');
		await searchInput.fill('home');

		await expect(authenticatedPage.getByText('/home')).toBeVisible();
		await expect(authenticatedPage.getByText('/about')).not.toBeVisible();

		// Clear search → all rows return
		await searchInput.clear();
		await expect(authenticatedPage.getByText('/about')).toBeVisible({ timeout: 5000 });
	});

	test('clicking a row expands referrer details', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/content');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for table
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 15000 });

		// Click the /home row to expand it
		await authenticatedPage.getByText('/home').click();

		// Expanded section should show referrer info
		await expect(authenticatedPage.getByText('Top Referrers')).toBeVisible({ timeout: 5000 });
		await expect(authenticatedPage.getByText('google.com', { exact: false })).toBeVisible();
	});
});

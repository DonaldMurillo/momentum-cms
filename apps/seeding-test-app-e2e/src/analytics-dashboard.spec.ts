import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Analytics Dashboard & Sidebar Grouping E2E Tests
 *
 * Tests:
 * - Sidebar collection grouping by admin.group field
 * - Plugin admin route rendering in sidebar
 * - Analytics query API endpoints (GET /summary, GET /query)
 * - Analytics dashboard page rendering and navigation
 */

test.describe('Sidebar Collection Grouping', { tag: ['@analytics', '@smoke'] }, () => {
	test('displays collection groups based on admin.group field', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Named groups appear before the default "Collections" group
		// "Content" group: articles, categories, pages
		await expect(sidebar.getByText('Content', { exact: true })).toBeVisible();
		// "Admin" group: users
		await expect(sidebar.getByText('Admin', { exact: true })).toBeVisible();
		// Default "Collections" group: products, settings, events, media, etc.
		await expect(sidebar.getByText('Collections', { exact: true })).toBeVisible();
	});

	test('Content group contains articles, categories, and pages', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// All three collections should be visible in sidebar
		await expect(sidebar.getByRole('link', { name: 'Articles' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Categories' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Pages' })).toBeVisible();
	});

	test('Admin group contains users', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar.getByRole('link', { name: 'Users' })).toBeVisible();
	});

	test('Collections group contains ungrouped collections', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Products, Settings, Events, etc. have no admin.group → default "Collections"
		await expect(sidebar.getByRole('link', { name: 'Products' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Events' })).toBeVisible();
	});
});

test.describe('Plugin Admin Routes in Sidebar', { tag: ['@analytics', '@smoke'] }, () => {
	test('displays Analytics section with plugin links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// "Analytics" group heading and link both exist in sidebar
		const analyticsLink = sidebar.getByRole('link', { name: 'Analytics' });
		await expect(analyticsLink).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Content Perf.' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Tracking Rules' })).toBeVisible();
	});

	test('Analytics sidebar link navigates to analytics dashboard', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		const analyticsLink = sidebar.getByRole('link', { name: 'Analytics' });
		await analyticsLink.click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/analytics/, { timeout: 10000 });
	});
});

test.describe('Analytics API Endpoints', { tag: ['@analytics', '@api'] }, () => {
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
	});

	test('GET /api/analytics/summary returns summary data with enhanced fields', async ({
		request,
	}) => {
		// Generate some analytics data first
		await request.get('/api/categories');

		const response = await request.get('/api/analytics/summary');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			totalEvents: number;
			byCategory: Record<string, number>;
			byCollection: Record<string, number>;
			contentOperations: { created: number; updated: number; deleted: number };
			apiMetrics: { totalRequests: number; avgDuration: number };
			activeSessions: number;
			activeVisitors: number;
			topPages: Array<{ url: string; count: number }>;
			topReferrers: Array<{ referrer: string; count: number }>;
			deviceBreakdown: Record<string, number>;
			browserBreakdown: Record<string, number>;
		};

		expect(typeof data.totalEvents).toBe('number');
		expect(data.totalEvents).toBeGreaterThanOrEqual(0);
		expect(typeof data.byCategory).toBe('object');
		expect(typeof data.byCollection).toBe('object');
		expect(typeof data.contentOperations.created).toBe('number');
		expect(typeof data.contentOperations.updated).toBe('number');
		expect(typeof data.contentOperations.deleted).toBe('number');
		expect(typeof data.apiMetrics.totalRequests).toBe('number');
		expect(typeof data.apiMetrics.avgDuration).toBe('number');
		expect(typeof data.activeSessions).toBe('number');
		expect(typeof data.activeVisitors).toBe('number');

		// New enhanced fields
		expect(Array.isArray(data.topPages)).toBe(true);
		expect(Array.isArray(data.topReferrers)).toBe(true);
		expect(typeof data.deviceBreakdown).toBe('object');
		expect(typeof data.browserBreakdown).toBe('object');
	});

	test('GET /api/analytics/query returns paginated events', async ({ request }) => {
		// Generate analytics data
		const slug = `analytics-query-${Date.now()}`;
		await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Query Test', slug },
		});

		const response = await request.get('/api/analytics/query?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			events: Array<{
				id: string;
				name: string;
				category: string;
				timestamp: string;
				context: Record<string, unknown>;
			}>;
			total: number;
			page: number;
			limit: number;
		};

		expect(Array.isArray(data.events)).toBe(true);
		expect(typeof data.total).toBe('number');
		expect(typeof data.page).toBe('number');
		expect(typeof data.limit).toBe('number');
	});

	test('GET /api/analytics/query supports search filter', async ({ request }) => {
		// Generate a known content event
		const slug = `analytics-search-${Date.now()}`;
		await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Search Filter Test', slug },
		});

		// Search for "content_created" by name
		const response = await request.get('/api/analytics/query?search=content_created&limit=50');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			events: Array<{ name: string }>;
			total: number;
		};

		// All returned events should match the search term
		for (const event of data.events) {
			expect(event.name).toContain('content_created');
		}
	});

	test('GET /api/analytics/query supports pagination', async ({ request }) => {
		// Generate enough events for pagination (at least 3 so limit=2 gives 2 pages)
		for (let i = 0; i < 3; i++) {
			await request.get('/api/categories');
		}

		const page1 = await request.get('/api/analytics/query?limit=2&page=1');
		expect(page1.ok()).toBe(true);
		const data1 = (await page1.json()) as {
			events: Array<{ id: string }>;
			total: number;
			page: number;
			limit: number;
		};
		expect(data1.page).toBe(1);
		expect(data1.limit).toBe(2);
		expect(data1.events.length).toBeLessThanOrEqual(2);

		// We generated 3+ events, so total should exceed our limit
		expect(data1.total).toBeGreaterThan(2);

		const page2 = await request.get('/api/analytics/query?limit=2&page=2');
		expect(page2.ok()).toBe(true);
		const data2 = (await page2.json()) as {
			events: Array<{ id: string }>;
			page: number;
		};
		expect(data2.page).toBe(2);
		expect(data2.events.length).toBeGreaterThan(0);
		// Page 2 events should differ from page 1
		expect(data2.events[0].id).not.toBe(data1.events[0].id);
	});

	test('GET /api/analytics/query supports date range filtering', async ({ request }) => {
		// Generate an event now
		await request.get('/api/categories');

		// Query with a from date in the future — should return no events
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		const response = await request.get(`/api/analytics/query?from=${futureDate}&limit=50`);
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { events: unknown[]; total: number };
		expect(data.total).toBe(0);
	});

	test('GET /api/analytics/query supports category filter', async ({ request }) => {
		// Generate a content event
		const slug = `analytics-cat-filter-${Date.now()}`;
		await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Cat Filter Test', slug },
		});

		const response = await request.get('/api/analytics/query?category=content&limit=50');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			events: Array<{ category: string }>;
		};

		// All returned events should be content category
		for (const event of data.events) {
			expect(event.category).toBe('content');
		}
	});
});

test.describe('Analytics Dashboard Page', { tag: ['@analytics', '@smoke'] }, () => {
	test('renders dashboard heading and overview section', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Dashboard heading
		const heading = authenticatedPage.getByRole('heading', { name: 'Analytics' });
		await expect(heading).toBeVisible({ timeout: 15000 });

		// Overview section
		await expect(authenticatedPage.getByText('Overview')).toBeVisible();
	});

	test('renders metric cards or loading skeletons', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the page to load — either we see metric labels or skeleton loaders
		// The summary fetches async, so we wait for a metric label to appear
		await expect(
			authenticatedPage.getByText('Total Events').or(authenticatedPage.locator('mcms-skeleton')),
		).toBeVisible({ timeout: 15000 });
	});

	test('renders recent activity section', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByText('Recent Activity')).toBeVisible({
			timeout: 15000,
		});

		// Category filter buttons should be present
		// Note: "All" button appears in both date range and category selectors — check unique ones
		await expect(authenticatedPage.getByRole('button', { name: 'Content' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'API' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'Custom' })).toBeVisible();
	});

	test('renders date range selector buttons', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for dashboard to load
		await expect(authenticatedPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
			timeout: 15000,
		});

		// Date range buttons
		await expect(authenticatedPage.getByRole('button', { name: '24h' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: '7d' })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: '30d' })).toBeVisible();
		// "All" button exists for both date range and category filter
		const allButtons = authenticatedPage.getByRole('button', { name: 'All' });
		await expect(allButtons.first()).toBeVisible();
	});

	test('renders search input', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
			timeout: 15000,
		});

		const searchInput = authenticatedPage.getByLabel('Search analytics events');
		await expect(searchInput).toBeVisible();
	});

	test('renders refresh button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
			timeout: 15000,
		});

		await expect(authenticatedPage.getByRole('button', { name: 'Refresh' })).toBeVisible();
	});

	test('renders events table after data loads', async ({ request, authenticatedPage }) => {
		// Generate some analytics data first via API
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const slug = `analytics-table-${Date.now()}`;
		await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Table Test', slug },
		});

		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the events table or empty state to appear
		await expect(
			authenticatedPage.getByRole('table').or(authenticatedPage.getByText('No events recorded')),
		).toBeVisible({ timeout: 15000 });
	});
});

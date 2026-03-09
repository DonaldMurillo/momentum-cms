import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Observability Plugin — User Flow Stories
 *
 * Tests real user journeys for the OpenTelemetry observability plugin:
 * - Prometheus metrics scraping with real CRUD counters
 * - Per-collection metric granularity
 * - Admin dashboard navigation and live data
 * - Security boundaries (admin-only summary API, open Prometheus)
 * - HTTP request metrics capturing real traffic
 */

// OTel plugin is only configured in the Angular example app
const otelSkipCondition = () =>
	process.env['E2E_SERVER_FLAVOR'] === 'nestjs' || process.env['E2E_SERVER_FLAVOR'] === 'analog';
const otelSkipReason = 'OTel plugin is only configured in the Angular example app';

function uniqueSlug(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Observability Plugin — Prometheus Metrics', { tag: ['@otel', '@api'] }, () => {
	test.skip(otelSkipCondition, otelSkipReason);
	test.beforeEach(async ({ request }) => {
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('As a DevOps engineer, I should be able to point Prometheus at my CMS and scrape real metrics after CRUD operations', async ({
		request,
	}) => {
		const slug = uniqueSlug('otel-prom');
		const create = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'OTel Prometheus Test', slug },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		try {
			const update = await request.patch(`/api/articles/${doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'OTel Prometheus Test Updated' },
			});
			expect(update.ok()).toBe(true);

			await request.delete(`/api/articles/${doc.id}`);

			// Scrape /metrics — the real Prometheus endpoint
			const metricsRes = await request.get('/metrics');
			expect(metricsRes.ok()).toBe(true);

			const contentType = metricsRes.headers()['content-type'] ?? '';
			expect(contentType).toContain('text/plain');

			const metricsText = await metricsRes.text();

			// Verify collection operation metrics exist with article labels as proper Prometheus labels
			expect(metricsText).toMatch(
				/momentum_collection_operation_total\{[^}]*collection="articles"/,
			);

			// Verify HTTP metrics are also present
			expect(metricsText).toMatch(/http_server_request_duration/);
		} finally {
			await request.delete(`/api/articles/${doc.id}`);
		}
	});

	test('As a DevOps engineer, I should see per-collection metric granularity across multiple collections', async ({
		request,
	}) => {
		const articleSlug = uniqueSlug('otel-multi-a');
		const catSlug = uniqueSlug('otel-multi-c');

		const article = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'OTel Multi Article', slug: articleSlug },
		});
		expect(article.status()).toBe(201);
		const articleDoc = (await article.json()) as { doc: { id: string } };

		const category = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'OTel Multi Category', slug: catSlug },
		});
		expect(category.status()).toBe(201);
		const catDoc = (await category.json()) as { doc: { id: string } };

		try {
			// Scrape and verify both collections appear as separate Prometheus label sets
			const metricsRes = await request.get('/metrics');
			expect(metricsRes.ok()).toBe(true);
			const metricsText = await metricsRes.text();

			// Both collections should appear as collection labels in metric lines
			expect(metricsText).toMatch(
				/momentum_collection_operation_total\{[^}]*collection="articles"/,
			);
			expect(metricsText).toMatch(
				/momentum_collection_operation_total\{[^}]*collection="categories"/,
			);
		} finally {
			await request.delete(`/api/articles/${articleDoc.doc.id}`);
			await request.delete(`/api/categories/${catDoc.doc.id}`);
		}
	});

	test('As a DevOps engineer, I should see HTTP request metrics that reflect actual traffic patterns', async ({
		request,
	}) => {
		const slug = uniqueSlug('otel-http');
		const create = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'OTel HTTP Test', slug },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		try {
			// GET (list)
			const list = await request.get('/api/articles');
			expect(list.ok()).toBe(true);

			// GET (single)
			const single = await request.get(`/api/articles/${doc.id}`);
			expect(single.ok()).toBe(true);

			// PATCH (update)
			const update = await request.patch(`/api/articles/${doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Updated HTTP Test' },
			});
			expect(update.ok()).toBe(true);

			// DELETE
			const del = await request.delete(`/api/articles/${doc.id}`);
			expect(del.ok()).toBe(true);

			// Scrape metrics
			const metricsRes = await request.get('/metrics');
			expect(metricsRes.ok()).toBe(true);
			const metricsText = await metricsRes.text();

			// Should have request total metric
			expect(metricsText).toMatch(/http_server_request_total/);

			// Different HTTP methods should appear as label values in metric lines
			expect(metricsText).toMatch(/http_server_request_total\{[^}]*method="POST"/);
			expect(metricsText).toMatch(/http_server_request_total\{[^}]*method="GET"/);
			expect(metricsText).toMatch(/http_server_request_total\{[^}]*method="PATCH"/);
			expect(metricsText).toMatch(/http_server_request_total\{[^}]*method="DELETE"/);
		} finally {
			await request.delete(`/api/articles/${doc.id}`);
		}
	});
});

test.describe('Observability Plugin — Admin Dashboard', { tag: ['@otel', '@admin'] }, () => {
	test.skip(otelSkipCondition, otelSkipReason);
	test('As an admin, I should be able to see my system health from the observability dashboard', async ({
		authenticatedPage,
	}) => {
		// Start from the admin dashboard
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Verify "Observability" appears in the sidebar
		const sidebar = authenticatedPage.getByLabel('Main navigation');
		const otelLink = sidebar.getByRole('link', { name: 'Observability' });
		await expect(otelLink).toBeVisible({ timeout: 10000 });

		// Navigate via sidebar
		await otelLink.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/observability/, {
			timeout: 10000,
		});

		// Wait for real content to load (heading proves data loaded, not stuck on skeleton)
		await expect(authenticatedPage.getByRole('heading', { name: /Observability/i })).toBeVisible({
			timeout: 15000,
		});

		// System Health section should show uptime (proves real data loaded)
		await expect(authenticatedPage.getByRole('heading', { name: 'System Health' })).toBeVisible({
			timeout: 15000,
		});

		// Request Metrics section should exist (page load itself generates requests)
		await expect(authenticatedPage.getByRole('heading', { name: 'Request Metrics' })).toBeVisible({
			timeout: 15000,
		});
	});

	test('As an admin, after creating content I should see that activity in the observability dashboard', async ({
		authenticatedPage,
		request,
	}) => {
		// Sign in for API calls
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		// Create articles and update one via API
		const slug1 = uniqueSlug('otel-dash-1');
		const slug2 = uniqueSlug('otel-dash-2');

		const create1 = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'OTel Dashboard Test 1', slug: slug1 },
		});
		expect(create1.status()).toBe(201);
		const doc1 = (await create1.json()) as { doc: { id: string } };

		const create2 = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'OTel Dashboard Test 2', slug: slug2 },
		});
		expect(create2.status()).toBe(201);
		const doc2 = (await create2.json()) as { doc: { id: string } };

		try {
			const update = await request.patch(`/api/articles/${doc1.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'OTel Dashboard Test 1 Updated' },
			});
			expect(update.ok()).toBe(true);

			// Navigate to observability dashboard
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const sidebar = authenticatedPage.getByLabel('Main navigation');
			await sidebar.getByRole('link', { name: 'Observability' }).click();
			await expect(authenticatedPage).toHaveURL(/\/admin\/observability/, {
				timeout: 10000,
			});

			// Wait for data to load
			await expect(authenticatedPage.getByText('Collection Operations')).toBeVisible({
				timeout: 15000,
			});

			// "articles" should appear in the collection operations table
			// Scope to the table to avoid matching sidebar/breadcrumb text
			const collectionTable = authenticatedPage.locator('table').first();
			await expect(collectionTable.getByText('articles')).toBeVisible({
				timeout: 10000,
			});

			// Verify actual create counts are > 0 (not just the collection name)
			// The table has columns: Collection | Creates | Updates | Deletes | Avg Duration
			const articlesRow = collectionTable.locator('tr', { hasText: 'articles' });
			await expect(articlesRow).toBeVisible({ timeout: 10000 });
			// The creates cell (2nd column) should not be "0"
			const cells = articlesRow.locator('td');
			const createsText = await cells.nth(1).textContent();
			expect(Number(createsText?.trim())).toBeGreaterThanOrEqual(2);

			// Recent Traces section should show span entries
			await expect(authenticatedPage.getByText('Recent Traces')).toBeVisible({
				timeout: 10000,
			});
		} finally {
			// Cleanup both articles
			await request.delete(`/api/articles/${doc1.doc.id}`);
			await request.delete(`/api/articles/${doc2.doc.id}`);
		}
	});
});

test.describe('Observability Plugin — Security Boundaries', { tag: ['@otel', '@security'] }, () => {
	test.skip(otelSkipCondition, otelSkipReason);
	test('As a non-admin, I should NOT be able to see observability summary data but Prometheus should stay open', async ({
		request,
		viewerPage,
	}) => {
		// Viewer role: attempt summary API via the viewer page's request context
		const viewerSummary = await viewerPage.request.get('/api/otel/summary');
		expect(viewerSummary.status()).toBe(403);

		// Unauthenticated: create a fresh request context (no auth cookies)
		const unauthSummary = await request.get('/api/otel/summary');
		expect(unauthSummary.status()).toBe(401);

		// Prometheus endpoint SHOULD be accessible without auth
		// (Prometheus scrapers don't carry auth tokens)
		const metricsRes = await request.get('/metrics');
		expect(metricsRes.ok()).toBe(true);
		const metricsText = await metricsRes.text();
		expect(metricsText).toMatch(/http_server_request/);
	});

	test('As an admin, I should be able to access the summary API', async ({ request }) => {
		// Sign in as admin
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const summary = await request.get('/api/otel/summary');
		expect(summary.ok()).toBe(true);

		const data = (await summary.json()) as {
			uptime: number;
			activeRequests: number;
			memoryUsageMb: number;
			requestMetrics: { totalRequests: number };
		};

		// Verify real data — uptime should be positive
		expect(data.uptime).toBeGreaterThan(0);
		expect(data.memoryUsageMb).toBeGreaterThan(0);
		expect(data.requestMetrics.totalRequests).toBeGreaterThan(0);
	});
});

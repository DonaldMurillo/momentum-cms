import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * SEO Dashboard & Admin UI E2E Tests
 *
 * Tests:
 * - SEO link appears in sidebar
 * - SEO dashboard page renders
 * - SEO fields appear on collection edit forms
 */

test.describe('SEO Plugin Admin Routes', { tag: ['@seo', '@smoke'] }, () => {
	test('displays SEO link in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar.getByRole('link', { name: 'SEO' })).toBeVisible({ timeout: 15000 });
	});

	test('SEO sidebar link navigates to SEO dashboard', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'SEO' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/seo/, { timeout: 10000 });
	});
});

test.describe('SEO Dashboard Page', { tag: ['@seo'] }, () => {
	test('renders dashboard heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'SEO' });
		await expect(heading).toBeVisible({ timeout: 15000 });
	});

	test('renders overview section with cards or loading state', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the dashboard heading first to confirm page loaded
		await expect(authenticatedPage.getByRole('heading', { name: 'SEO' })).toBeVisible({
			timeout: 15000,
		});

		await expect(
			authenticatedPage.getByText('Average Score').or(authenticatedPage.locator('mcms-skeleton')),
		).toBeVisible({ timeout: 15000 });
	});

	test('renders refresh button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'SEO' })).toBeVisible({
			timeout: 15000,
		});

		await expect(authenticatedPage.getByRole('button', { name: 'Refresh' })).toBeVisible();
	});

	test('displays analysis results after document creation', async ({
		authenticatedPage,
		request,
	}) => {
		// Sign in via API and create a document with SEO data to trigger analysis
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const slug = `seo-dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Dashboard Test Page',
				slug,
				seo: {
					metaTitle: 'A well-optimized title for the dashboard test page here now',
					metaDescription:
						'This meta description is well-written and provides a clear summary of the content for search results pages.',
					focusKeyword: 'dashboard test',
				},
			},
		});
		expect(create.status()).toBe(201);

		// Wait for async analysis to complete
		const doc = (await create.json()) as { doc: { id: string } };
		await expect
			.poll(
				async () => {
					const resp = await request.get('/api/seo/analyses?limit=100');
					if (!resp.ok()) return false;
					const data = (await resp.json()) as {
						docs: Array<{ documentId: string }>;
					};
					return data.docs.some((d) => d.documentId === doc.doc.id);
				},
				{ timeout: 10_000, message: 'SEO analysis should exist before checking dashboard' },
			)
			.toBe(true);

		// Navigate to dashboard and verify data shows
		await authenticatedPage.goto('/admin/seo');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the overview cards to appear with analysis data
		await expect(authenticatedPage.getByText('Documents Analyzed', { exact: true })).toBeVisible({
			timeout: 15000,
		});
	});
});

test.describe('Sitemap Settings Page', { tag: ['@seo'] }, () => {
	test('displays Sitemap link in sidebar under SEO group', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar.getByRole('link', { name: 'Sitemap' })).toBeVisible({ timeout: 15000 });
	});

	test('Sitemap page renders heading and table', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo/sitemap');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Heading should be visible
		await expect(authenticatedPage.getByRole('heading', { name: 'Sitemap' })).toBeVisible({
			timeout: 15000,
		});

		// Summary cards should show (use .first() since text also appears in table headers)
		await expect(authenticatedPage.getByText('Total Collections').first()).toBeVisible({
			timeout: 10000,
		});
		await expect(authenticatedPage.getByText('In Sitemap').first()).toBeVisible();
		await expect(authenticatedPage.getByText('Excluded').first()).toBeVisible();
	});

	test('Sitemap page lists SEO-enabled collections', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo/sitemap');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Sitemap' })).toBeVisible({
			timeout: 15000,
		});

		// Should show at least the pages collection in the table
		await expect(authenticatedPage.getByRole('table')).toBeVisible({ timeout: 10000 });
		await expect(authenticatedPage.getByRole('cell', { name: 'pages' })).toBeVisible();
	});
});

test.describe('Robots Settings Page', { tag: ['@seo'] }, () => {
	test('displays Robots link in sidebar under SEO group', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar.getByRole('link', { name: 'Robots' })).toBeVisible({ timeout: 15000 });
	});

	test('Robots page renders heading and preview', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo/robots');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Robots', level: 1 })).toBeVisible({
			timeout: 15000,
		});

		// Preview section should show
		await expect(authenticatedPage.getByRole('heading', { name: 'Preview' })).toBeVisible({
			timeout: 10000,
		});
	});

	test('Robots page renders rule editor and save button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/seo/robots');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Robots', level: 1 })).toBeVisible({
			timeout: 15000,
		});

		// Rule section should have "Rules" heading and "Add Rule" button
		await expect(authenticatedPage.getByRole('heading', { name: 'Rules', level: 2 })).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'Add new rule' })).toBeVisible();

		// Save button should be present
		await expect(authenticatedPage.getByRole('button', { name: /Save/ })).toBeVisible();
	});
});

test.describe('SEO Fields in Admin UI', { tag: ['@seo'] }, () => {
	test('SEO tab appears on page edit form', async ({ authenticatedPage, request }) => {
		// Create a page via API
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const slug = `seo-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'SEO UI Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Navigate to the EDIT page (view page does not render field renderers)
		await authenticatedPage.goto(`/admin/collections/pages/${doc.doc.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the form to be ready
		await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible({
			timeout: 15000,
		});

		// SEO should appear as a tab trigger (not a group)
		const mainContent = authenticatedPage.locator('#mcms-main-content');
		const seoTab = mainContent.getByRole('tab', { name: 'SEO' });
		await expect(seoTab).toBeVisible();

		// Content tab should also be present and selected by default
		const contentTab = mainContent.getByRole('tab', { name: 'Content' });
		await expect(contentTab).toBeVisible();
		await expect(contentTab).toHaveAttribute('aria-selected', 'true');
	});

	test('clicking SEO tab shows SEO fields', async ({ authenticatedPage, request }) => {
		// Create a page via API
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const slug = `seo-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'SEO Tab Fields Test', slug },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Navigate to the EDIT page
		await authenticatedPage.goto(`/admin/collections/pages/${doc.doc.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the form to be ready
		await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible({
			timeout: 15000,
		});

		// Click the SEO tab
		const mainContent = authenticatedPage.locator('#mcms-main-content');
		const seoTab = mainContent.getByRole('tab', { name: 'SEO' });
		await expect(seoTab).toBeVisible();
		await seoTab.click();

		// SEO fields should be visible after clicking the tab
		await expect(mainContent.getByRole('textbox', { name: 'Meta Title' })).toBeVisible({
			timeout: 10000,
		});
		await expect(mainContent.getByRole('textbox', { name: 'Meta Description' })).toBeVisible();
	});
});

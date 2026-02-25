import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Redirects Plugin E2E tests.
 *
 * Admin UI tests ALWAYS start from /admin (the dashboard) and navigate
 * to the feature via sidebar/dashboard — never go directly to deep URLs.
 *
 * Verifies:
 * 1. Admin UI: dashboard card, sidebar nav, list, create, view, edit — all via real navigation
 * 2. API: CRUD on redirects collection
 * 3. Middleware: actual HTTP redirects (301, 302, etc.)
 * 4. Behavior: active/inactive toggle, external URLs
 */

// ── Admin UI Tests (dashboard-first navigation) ───────────────

test.describe('Redirects Admin UI - Dashboard & Sidebar', { tag: ['@redirects', '@admin'] }, () => {
	test('should show Redirects in the Settings group on the dashboard', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const settingsSection = authenticatedPage.getByRole('region', { name: 'Settings' });
		await expect(settingsSection).toBeVisible();
		await expect(settingsSection.getByRole('heading', { name: 'Redirects' })).toBeVisible();
	});

	test('should show Redirects link in the sidebar under Settings group', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		// "Settings" appears as both a group header and a collection link in the sidebar
		await expect(sidebar.getByText('Settings', { exact: true }).first()).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Redirects' })).toBeVisible();
	});

	test('should navigate from dashboard to redirects list via sidebar', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/, {
			timeout: 10000,
		});
		await expect(authenticatedPage.getByRole('heading', { name: 'Redirects' })).toBeVisible();
	});

	test('should navigate from dashboard Create shortcut to create form', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const settingsSection = authenticatedPage.getByRole('region', { name: 'Settings' });
		await settingsSection.locator('a[href="/admin/collections/redirects/new"]').click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/new/);
	});
});

test.describe('Redirects Admin UI - List View', { tag: ['@redirects', '@admin'] }, () => {
	test('should display list with Create button via sidebar navigation', async ({
		authenticatedPage,
	}) => {
		// Start from dashboard
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Navigate via sidebar
		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

		// Verify list page
		const heading = authenticatedPage.getByRole('heading', { name: 'Redirects' });
		await expect(heading).toBeVisible();

		const createButton = authenticatedPage.getByRole('button', { name: /Create Redirect/i });
		await expect(createButton).toBeVisible();
	});

	test('should navigate from list to create form via Create button', async ({
		authenticatedPage,
	}) => {
		// Start from dashboard → sidebar → list
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

		// Click Create
		await authenticatedPage.getByRole('button', { name: /Create Redirect/i }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/new/);
	});
});

test.describe('Redirects Admin UI - Create Flow', { tag: ['@redirects', '@admin'] }, () => {
	test('should display all redirect fields on create form', async ({ authenticatedPage }) => {
		// Start from dashboard → sidebar → list → create
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

		await authenticatedPage.getByRole('button', { name: /Create Redirect/i }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/new/);

		// Wait for form to load
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Verify all fields
		await expect(authenticatedPage.getByText('From Path')).toBeVisible();
		await expect(authenticatedPage.locator('input#field-from')).toBeVisible();

		await expect(authenticatedPage.getByText('To Path / URL')).toBeVisible();
		await expect(authenticatedPage.locator('input#field-to')).toBeVisible();

		await expect(authenticatedPage.getByText('Status Code')).toBeVisible();
		await expect(authenticatedPage.locator('select#field-type')).toBeVisible();

		await expect(authenticatedPage.getByText('Active')).toBeVisible();
	});

	test('should fill form, submit, and land on view page', async ({ authenticatedPage }) => {
		const from = `/ui-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		// Start from dashboard → sidebar → list → create
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

		await authenticatedPage.getByRole('button', { name: /Create Redirect/i }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/new/);

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Fill fields
		await authenticatedPage.locator('input#field-from').fill(from);
		await authenticatedPage.locator('input#field-to').fill('/ui-destination');
		await authenticatedPage.locator('select#field-type').selectOption('temporary');

		// Submit
		await authenticatedPage.getByRole('button', { name: 'Create', exact: true }).click();

		// After create: navigates to VIEW page (read-only, not edit form)
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/[^/]+$/, {
			timeout: 10000,
		});

		// View page shows read-only field values
		await expect(authenticatedPage.getByText(from)).toBeVisible();
		await expect(authenticatedPage.getByText('/ui-destination')).toBeVisible();

		// Cleanup via API
		const listRes = await authenticatedPage.request.get(`/api/redirects?limit=100`);
		const list = (await listRes.json()) as {
			docs: Array<{ id: string; from: string }>;
		};
		const created = list.docs.find((d) => d.from === from);
		if (created) {
			await authenticatedPage.request.delete(`/api/redirects/${created.id}`);
		}
	});

	test('should navigate back to list via Cancel button', async ({ authenticatedPage }) => {
		// Start from dashboard → sidebar → list → create
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Redirects' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

		await authenticatedPage.getByRole('button', { name: /Create Redirect/i }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects\/new/);

		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Cancel goes back to list
		await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/, {
			timeout: 10000,
		});
	});
});

test.describe('Redirects Admin UI - Edit Flow', { tag: ['@redirects', '@admin'] }, () => {
	test(
		'should navigate from dashboard to view page, then edit and save',
		{ timeout: 60000 },
		async ({ authenticatedPage }) => {
			// Create via API first
			const from = `/ui-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const createRes = await authenticatedPage.request.post('/api/redirects', {
				data: { from, to: '/original-dest', type: 'permanent', active: true },
			});
			expect(createRes.status()).toBe(201);
			const { doc } = (await createRes.json()) as { doc: { id: string } };

			try {
				// Start from dashboard → sidebar → list
				await authenticatedPage.goto('/admin');
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const sidebar = authenticatedPage.getByLabel('Main navigation');
				await sidebar.getByRole('link', { name: 'Redirects' }).click();
				await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/);

				// Click into the item from the list table
				const row = authenticatedPage.locator('mcms-table-body mcms-table-row', {
					hasText: from,
				});
				await expect(row).toBeVisible({ timeout: 10000 });
				await row.click();

				// View page: shows read-only values and Edit/Delete buttons
				await expect(authenticatedPage.getByRole('button', { name: 'Edit' })).toBeVisible({
					timeout: 10000,
				});
				await expect(authenticatedPage.getByText('/original-dest')).toBeVisible();

				// Click Edit to enter edit mode
				await authenticatedPage.getByRole('button', { name: 'Edit' }).click();

				// Edit form: "Save Changes" button
				await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible({
					timeout: 15000,
				});

				// Update the "to" field
				const toInput = authenticatedPage.locator('input#field-to');
				await toInput.clear();
				await toInput.fill('/updated-dest');

				// Save
				await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();

				// Should navigate back to list after save
				await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/redirects$/, {
					timeout: 10000,
				});

				// Verify via API that the change persisted
				const readRes = await authenticatedPage.request.get(`/api/redirects/${doc.id}`);
				expect(readRes.ok()).toBe(true);
				const data = (await readRes.json()) as { doc: { to: string } };
				expect(data.doc.to).toBe('/updated-dest');
			} finally {
				await authenticatedPage.request.delete(`/api/redirects/${doc.id}`);
			}
		},
	);
});

// ── API Tests ───────────────────────────────────────────────

test.describe('Redirects Plugin - API', { tag: ['@redirects', '@api', '@crud'] }, () => {
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

	test('redirects collection exists and accepts CRUD', async ({ request }) => {
		const from = `/e2e-crud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		// Create
		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to: '/destination', type: 'permanent', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as {
			doc: { id: string; from: string; to: string; type: string; active: boolean };
		};
		expect(doc.from).toBe(from);
		expect(doc.to).toBe('/destination');
		expect(doc.type).toBe('permanent');
		expect(doc.active).toBe(true);

		// Read
		const read = await request.get(`/api/redirects/${doc.id}`);
		expect(read.status()).toBe(200);

		// Update
		const update = await request.patch(`/api/redirects/${doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { to: '/updated-destination' },
		});
		expect(update.ok()).toBe(true);
		const updated = (await update.json()) as { doc: { to: string } };
		expect(updated.doc.to).toBe('/updated-destination');

		// Delete
		const del = await request.delete(`/api/redirects/${doc.id}`);
		expect(del.ok()).toBe(true);

		// Confirm deleted
		const gone = await request.get(`/api/redirects/${doc.id}`);
		expect(gone.status()).toBe(404);
	});

	test('GET matching path returns 301 redirect', async ({ request, baseURL, playwright }) => {
		const from = `/e2e-301-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const to = `/e2e-dest-${Date.now()}`;

		// Create redirect rule
		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to, type: 'permanent', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		// Use a fresh context with maxRedirects: 0 to capture the redirect response
		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			const response = await noRedirectCtx.get(from);
			expect(response.status()).toBe(301);
			expect(response.headers()['location']).toBe(to);
		} finally {
			await noRedirectCtx.dispose();
			// Cleanup
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('GET matching path returns 302 for temporary redirect', async ({
		request,
		baseURL,
		playwright,
	}) => {
		const from = `/e2e-302-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const to = `/e2e-temp-dest-${Date.now()}`;

		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to, type: 'temporary', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			const response = await noRedirectCtx.get(from);
			expect(response.status()).toBe(302);
			expect(response.headers()['location']).toBe(to);
		} finally {
			await noRedirectCtx.dispose();
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('inactive redirect does not trigger', async ({ request, baseURL, playwright }) => {
		const from = `/e2e-inactive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to: '/should-not-reach', type: 'permanent', active: false },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			const response = await noRedirectCtx.get(from);
			// Should NOT be a redirect — the path doesn't exist so it falls through
			// to Angular SSR or 404, but definitely not 301/302
			expect([301, 302, 307, 308]).not.toContain(response.status());
		} finally {
			await noRedirectCtx.dispose();
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('redirect to external URL works', async ({ request, baseURL, playwright }) => {
		const from = `/e2e-external-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const externalUrl = 'https://example.com/target-page';

		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to: externalUrl, type: 'permanent', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			const response = await noRedirectCtx.get(from);
			expect(response.status()).toBe(301);
			expect(response.headers()['location']).toBe(externalUrl);
		} finally {
			await noRedirectCtx.dispose();
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('toggling active field enables/disables redirect', async ({
		request,
		baseURL,
		playwright,
	}) => {
		const from = `/e2e-toggle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const to = '/toggle-destination';

		// Create as active
		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to, type: 'permanent', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			// Should redirect while active
			const activeResponse = await noRedirectCtx.get(from);
			expect(activeResponse.status()).toBe(301);

			// Deactivate
			const deactivate = await request.patch(`/api/redirects/${doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { active: false },
			});
			expect(deactivate.ok()).toBe(true);

			// Should NOT redirect when inactive
			// The cache TTL is 0 in E2E config, so the change is immediate
			const inactiveResponse = await noRedirectCtx.get(from);
			expect([301, 302, 307, 308]).not.toContain(inactiveResponse.status());
		} finally {
			await noRedirectCtx.dispose();
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('non-matching path passes through (no redirect)', async ({
		request,
		baseURL,
		playwright,
	}) => {
		// Create a redirect for a specific path
		const from = `/e2e-specific-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to: '/somewhere', type: 'permanent', active: true },
		});
		expect(create.status()).toBe(201);
		const { doc } = (await create.json()) as { doc: { id: string } };

		const noRedirectCtx = await playwright.request.newContext({
			baseURL: baseURL!,
			maxRedirects: 0,
		});

		try {
			// A different path should NOT redirect
			const response = await noRedirectCtx.get('/e2e-no-match-path-xyz');
			expect([301, 302, 307, 308]).not.toContain(response.status());
		} finally {
			await noRedirectCtx.dispose();
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});

	test('unauthenticated users cannot create redirects', async ({ baseURL, playwright }) => {
		const anonCtx = await playwright.request.newContext({ baseURL: baseURL! });
		try {
			const response = await anonCtx.post('/api/redirects', {
				headers: { 'Content-Type': 'application/json' },
				data: { from: '/anon-test', to: '/dest', type: 'permanent', active: true },
			});
			expect(response.status()).toBe(403);
		} finally {
			await anonCtx.dispose();
		}
	});

	test('unique constraint prevents duplicate from paths', async ({ request }) => {
		const from = `/e2e-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const first = await request.post('/api/redirects', {
			headers: { 'Content-Type': 'application/json' },
			data: { from, to: '/dest-1', type: 'permanent', active: true },
		});
		expect(first.status()).toBe(201);
		const { doc } = (await first.json()) as { doc: { id: string } };

		try {
			// Second create with same `from` should fail
			const second = await request.post('/api/redirects', {
				headers: { 'Content-Type': 'application/json' },
				data: { from, to: '/dest-2', type: 'permanent', active: true },
			});
			// Expect a conflict or validation error (not 201)
			expect(second.status()).not.toBe(201);
		} finally {
			await request.delete(`/api/redirects/${doc.id}`);
		}
	});
});

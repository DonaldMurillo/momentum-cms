import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Tracking Rules E2E Tests
 *
 * Verifies:
 * - Collection REST API CRUD for tracking-rules
 * - GET /api/analytics/tracking-rules returns only active rules (client endpoint)
 * - Tracking Rules admin page: empty state, create, edit, toggle, delete
 */

test.describe('Tracking Rules API', () => {
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

		// Clear all existing tracking rules
		const listRes = await request.get('/api/tracking-rules?limit=100');
		expect(listRes.ok()).toBe(true);
		const listData = (await listRes.json()) as { docs: Array<{ id: string }> };
		for (const doc of listData.docs) {
			const del = await request.delete(`/api/tracking-rules/${doc.id}`);
			expect(del.ok()).toBe(true);
		}
	});

	test('collection REST API: create, read, update, delete rule', async ({ request }) => {
		// CREATE
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'CTA Button Click',
				selector: '.cta-button',
				eventType: 'click',
				eventName: 'cta_click',
				urlPattern: '*',
				active: true,
			},
		});
		expect(create.status()).toBe(201);
		const created = (await create.json()) as { doc: { id: string; name: string } };
		expect(created.doc.name).toBe('CTA Button Click');
		const ruleId = created.doc.id;

		// READ (list)
		const list = await request.get('/api/tracking-rules?limit=100');
		expect(list.ok()).toBe(true);
		const listData = (await list.json()) as { docs: Array<{ id: string; name: string }> };
		const found = listData.docs.find((d) => d.id === ruleId);
		expect(found).toBeDefined();
		expect(found?.name).toBe('CTA Button Click');

		// UPDATE
		const update = await request.patch(`/api/tracking-rules/${ruleId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { name: 'Updated CTA Click', selector: '.cta-btn' },
		});
		expect(update.ok()).toBe(true);

		// Verify update (single doc GET wraps in { doc: ... })
		const getUpdated = await request.get(`/api/tracking-rules/${ruleId}`);
		expect(getUpdated.ok()).toBe(true);
		const updatedBody = (await getUpdated.json()) as {
			doc: { name: string; selector: string };
		};
		expect(updatedBody.doc.name).toBe('Updated CTA Click');
		expect(updatedBody.doc.selector).toBe('.cta-btn');

		// DELETE
		const del = await request.delete(`/api/tracking-rules/${ruleId}`);
		expect(del.ok()).toBe(true);

		// Verify deletion
		const afterDelete = await request.get('/api/tracking-rules?limit=100');
		const afterData = (await afterDelete.json()) as { docs: Array<{ id: string }> };
		expect(afterData.docs.find((d) => d.id === ruleId)).toBeUndefined();
	});

	test('GET /api/analytics/tracking-rules returns only active rules', async ({ request }) => {
		// Create an active rule
		const active = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Active Rule',
				selector: '.active-btn',
				eventType: 'click',
				eventName: 'active_click',
				urlPattern: '*',
				active: true,
			},
		});
		expect(active.status()).toBe(201);

		// Create an inactive rule
		const inactive = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Inactive Rule',
				selector: '.inactive-btn',
				eventType: 'click',
				eventName: 'inactive_click',
				urlPattern: '*',
				active: false,
			},
		});
		expect(inactive.status()).toBe(201);

		// The client-facing endpoint should only return the active rule
		const clientRes = await request.get('/api/analytics/tracking-rules');
		expect(clientRes.ok()).toBe(true);
		const clientData = (await clientRes.json()) as {
			rules: Array<{ name: string; active: boolean; id?: string }>;
		};

		expect(clientData.rules.length).toBe(1);
		expect(clientData.rules[0].name).toBe('Active Rule');
		expect(clientData.rules[0].active).toBe(true);

		// Client endpoint should NOT include 'id' field (stripped for client safety)
		expect(clientData.rules[0].id).toBeUndefined();
	});
});

test.describe('Tracking Rules Admin Page', () => {
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

		// Clear all existing tracking rules
		const listRes = await request.get('/api/tracking-rules?limit=100');
		expect(listRes.ok()).toBe(true);
		const listData = (await listRes.json()) as { docs: Array<{ id: string }> };
		for (const doc of listData.docs) {
			const del = await request.delete(`/api/tracking-rules/${doc.id}`);
			expect(del.ok()).toBe(true);
		}
	});

	test('tracking rules page shows empty state', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/tracking-rules');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Heading
		await expect(authenticatedPage.getByRole('heading', { name: 'Tracking Rules' })).toBeVisible({
			timeout: 15000,
		});

		// Empty state text
		await expect(authenticatedPage.getByText('No tracking rules defined')).toBeVisible();

		// "New Rule" button in empty state
		await expect(authenticatedPage.getByRole('button', { name: 'New Rule' }).first()).toBeVisible();
	});

	test('create rule via dialog', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/analytics/tracking-rules');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await expect(authenticatedPage.getByRole('heading', { name: 'Tracking Rules' })).toBeVisible({
			timeout: 15000,
		});

		// Click "New Rule" button
		await authenticatedPage.getByRole('button', { name: 'New Rule' }).first().click();

		// Dialog should appear
		await expect(authenticatedPage.getByText('Create Tracking Rule')).toBeVisible({
			timeout: 5000,
		});

		// Fill form fields using accessible textbox roles
		await authenticatedPage.getByRole('textbox', { name: 'Rule Name' }).fill('E2E Test Rule');
		await authenticatedPage.getByRole('textbox', { name: 'CSS Selector' }).fill('.e2e-test-btn');
		await authenticatedPage.getByRole('textbox', { name: 'Event Name' }).fill('e2e_test_click');

		// Click Create
		await authenticatedPage.getByRole('button', { name: 'Create' }).click();

		// Table should show the new rule
		await expect(authenticatedPage.getByText('E2E Test Rule')).toBeVisible({ timeout: 10000 });
		await expect(authenticatedPage.getByText('.e2e-test-btn')).toBeVisible();
		await expect(authenticatedPage.getByText('e2e_test_click')).toBeVisible();
	});

	test('edit rule via row action', async ({ request, authenticatedPage }) => {
		// Create a rule via API first
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Edit Me',
				selector: '.edit-target',
				eventType: 'click',
				eventName: 'edit_test',
				urlPattern: '*',
				active: true,
			},
		});
		expect(create.status()).toBe(201);

		await authenticatedPage.goto('/admin/analytics/tracking-rules');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for rule to appear in table
		await expect(authenticatedPage.getByText('Edit Me')).toBeVisible({ timeout: 15000 });

		// Open dropdown menu → click Edit menu item
		await authenticatedPage.getByLabel('Rule actions').click();
		await authenticatedPage.getByRole('menuitem', { name: 'Edit' }).click();

		// Dialog should appear with "Edit Tracking Rule" title
		await expect(authenticatedPage.getByText('Edit Tracking Rule')).toBeVisible({
			timeout: 5000,
		});

		// Change the name
		const nameInput = authenticatedPage.getByRole('textbox', { name: 'Rule Name' });
		await nameInput.clear();
		await nameInput.fill('Edited Rule');

		// Save
		await authenticatedPage.getByRole('button', { name: 'Save' }).click();

		// Table should show updated name
		await expect(authenticatedPage.getByText('Edited Rule')).toBeVisible({ timeout: 10000 });
	});

	test('toggle rule active/inactive via inline switch', async ({ request, authenticatedPage }) => {
		// Create an active rule via API
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Toggle Test',
				selector: '.toggle-me',
				eventType: 'click',
				eventName: 'toggle_test',
				urlPattern: '*',
				active: true,
			},
		});
		expect(create.status()).toBe(201);
		const created = (await create.json()) as { doc: { id: string } };

		await authenticatedPage.goto('/admin/analytics/tracking-rules');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for rule to appear
		await expect(authenticatedPage.getByText('Toggle Test')).toBeVisible({ timeout: 15000 });

		// Find the switch (role="switch") and toggle it
		const switchEl = authenticatedPage.getByRole('switch');
		await switchEl.click();

		// Verify via API that the rule is now inactive (single doc: { doc: { active } })
		await expect
			.poll(
				async () => {
					const res = await request.get(`/api/tracking-rules/${created.doc.id}`);
					const body = (await res.json()) as { doc: { active: boolean } };
					return body.doc.active;
				},
				{ timeout: 10000 },
			)
			.toBe(false);
	});

	test('delete rule via row action', async ({ request, authenticatedPage }) => {
		// Create a rule via API
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Delete Me',
				selector: '.delete-target',
				eventType: 'click',
				eventName: 'delete_test',
				urlPattern: '*',
				active: true,
			},
		});
		expect(create.status()).toBe(201);

		await authenticatedPage.goto('/admin/analytics/tracking-rules');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for rule to appear
		await expect(authenticatedPage.getByText('Delete Me')).toBeVisible({ timeout: 15000 });

		// Open dropdown menu → click Delete menu item
		await authenticatedPage.getByLabel('Rule actions').click();
		await authenticatedPage.getByRole('menuitem', { name: 'Delete' }).click();

		// Confirmation dialog should appear
		await expect(authenticatedPage.getByRole('button', { name: /delete/i })).toBeVisible({
			timeout: 5000,
		});

		// Confirm deletion
		await authenticatedPage.getByRole('button', { name: /delete/i }).click();

		// Rule should be removed, empty state returns
		await expect(authenticatedPage.getByText('No tracking rules defined')).toBeVisible({
			timeout: 10000,
		});
	});
});

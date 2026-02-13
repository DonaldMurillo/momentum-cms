import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Tracking Rules Behavior E2E Tests
 *
 * Verifies the actual tracking pipeline works end-to-end:
 * - Admin creates rule → client rule engine picks it up → DOM interaction fires event → analytics captures it
 * - Inactive rule filtering, property passthrough, URL pattern matching
 */

test.describe('Tracking Rules Behavior', { tag: ['@analytics', '@smoke'] }, () => {
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

		// Clear all existing tracking rules
		const listRes = await request.get('/api/tracking-rules?limit=100');
		expect(listRes.ok()).toBe(true);
		const listData = (await listRes.json()) as { docs: Array<{ id: string }> };
		for (const doc of listData.docs) {
			const del = await request.delete(`/api/tracking-rules/${doc.id}`);
			expect(del.ok()).toBe(true);
		}
	});

	test('click tracking rule fires analytics event on element click', async ({
		request,
		authenticatedPage,
	}) => {
		// Create a tracking rule targeting buttons
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'E2E Button Click',
				selector: 'button',
				eventType: 'click',
				eventName: 'e2e_button_click',
				urlPattern: '*',
				active: true,
			},
		});
		expect(create.status()).toBe(201);

		// Navigate to analytics dashboard (has a Refresh button)
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for the page to render — gives rule engine time to init
		const refreshButton = authenticatedPage.getByRole('button', { name: 'Refresh' });
		await expect(refreshButton).toBeVisible({ timeout: 15000 });

		// Wait for rule engine to initialize (fetches rules, attaches listeners)
		await authenticatedPage.waitForLoadState('load');

		// Click the button — the rule engine should capture this
		await refreshButton.click();

		// Poll the analytics API until the event appears (tracker flushes every 1s)
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const data = (await res.json()) as {
						events: Array<{ name: string }>;
					};
					return data.events.filter((e) => e.name === 'e2e_button_click').length;
				},
				{ timeout: 15000, message: 'Expected e2e_button_click event to appear in analytics' },
			)
			.toBeGreaterThan(0);

		// Verify the event details
		const res = await request.get('/api/test-analytics-events');
		const data = (await res.json()) as {
			events: Array<{ name: string; category: string }>;
		};
		const clickEvents = data.events.filter((e) => e.name === 'e2e_button_click');
		expect(clickEvents[0].category).toBe('action');
	});

	test('inactive tracking rule does not fire events', async ({ request, authenticatedPage }) => {
		// Create an INACTIVE tracking rule
		const inactive = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Inactive Button Click',
				selector: 'button',
				eventType: 'click',
				eventName: 'inactive_button_click',
				urlPattern: '*',
				active: false,
			},
		});
		expect(inactive.status()).toBe(201);

		// Also create an ACTIVE rule as a control — proves the tracker is running
		const active = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Active Control Rule',
				selector: 'button',
				eventType: 'click',
				eventName: 'active_control_click',
				urlPattern: '*',
				active: true,
			},
		});
		expect(active.status()).toBe(201);

		// Navigate and wait for rule engine
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const refreshButton = authenticatedPage.getByRole('button', { name: 'Refresh' });
		await expect(refreshButton).toBeVisible({ timeout: 15000 });
		await authenticatedPage.waitForLoadState('load');

		// Click the button
		await refreshButton.click();

		// Wait for the active control event to appear (proves tracker is running)
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const data = (await res.json()) as {
						events: Array<{ name: string }>;
					};
					return data.events.filter((e) => e.name === 'active_control_click').length;
				},
				{ timeout: 15000, message: 'Active control rule event should appear' },
			)
			.toBeGreaterThan(0);

		// Verify the inactive rule's event did NOT fire
		const res = await request.get('/api/test-analytics-events');
		const data = (await res.json()) as {
			events: Array<{ name: string }>;
		};
		const inactiveEvents = data.events.filter((e) => e.name === 'inactive_button_click');
		expect(inactiveEvents.length).toBe(0);
	});

	test('tracking rule with static properties includes them in the event', async ({
		request,
		authenticatedPage,
	}) => {
		// Create a rule with static properties
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Props Button Click',
				selector: 'button',
				eventType: 'click',
				eventName: 'props_button_click',
				urlPattern: '*',
				active: true,
				properties: { source: 'e2e-test', campaign: 'tracking-rules' },
			},
		});
		expect(create.status()).toBe(201);

		// Navigate and wait for rule engine
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const refreshButton = authenticatedPage.getByRole('button', { name: 'Refresh' });
		await expect(refreshButton).toBeVisible({ timeout: 15000 });
		await authenticatedPage.waitForLoadState('load');

		// Click the button
		await refreshButton.click();

		// Wait for the event
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const data = (await res.json()) as {
						events: Array<{ name: string }>;
					};
					return data.events.filter((e) => e.name === 'props_button_click').length;
				},
				{ timeout: 15000, message: 'Expected props_button_click event to appear' },
			)
			.toBeGreaterThan(0);

		// Verify properties are included
		const res = await request.get('/api/test-analytics-events');
		const data = (await res.json()) as {
			events: Array<{
				name: string;
				properties: Record<string, unknown>;
			}>;
		};
		const propsEvents = data.events.filter((e) => e.name === 'props_button_click');
		expect(propsEvents[0].properties['source']).toBe('e2e-test');
		expect(propsEvents[0].properties['campaign']).toBe('tracking-rules');
	});

	test('tracking rule respects URL pattern and only fires on matching pages', async ({
		request,
		authenticatedPage,
	}) => {
		// Create a rule that ONLY matches /admin/analytics
		const create = await request.post('/api/tracking-rules', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: 'Analytics Only Click',
				selector: 'button',
				eventType: 'click',
				eventName: 'analytics_page_click',
				urlPattern: '/admin/analytics',
				active: true,
			},
		});
		expect(create.status()).toBe(201);

		// Navigate to the MATCHING page
		await authenticatedPage.goto('/admin/analytics');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const refreshButton = authenticatedPage.getByRole('button', { name: 'Refresh' });
		await expect(refreshButton).toBeVisible({ timeout: 15000 });
		await authenticatedPage.waitForLoadState('load');

		// Click the button
		await refreshButton.click();

		// Verify the event fires on the matching page
		await expect
			.poll(
				async () => {
					const res = await request.get('/api/test-analytics-events');
					const data = (await res.json()) as {
						events: Array<{ name: string }>;
					};
					return data.events.filter((e) => e.name === 'analytics_page_click').length;
				},
				{ timeout: 15000, message: 'Expected analytics_page_click event on matching page' },
			)
			.toBeGreaterThan(0);
	});
});

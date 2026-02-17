import type { Page } from '@playwright/test';
import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Named tabs E2E tests.
 *
 * Verifies that named tabs (tabs with a `name` property) create nested data
 * structures, similar to group fields, while unnamed tabs continue to hoist
 * fields to the top level.
 *
 * Also verifies tab UI behavior: default tab selection and query param
 * persistence across page refreshes.
 *
 * Uses the Settings collection which has both unnamed tabs (General, Social)
 * and a named tab (notifications) within the same tabs field.
 */

/** Settings document shape with named tab */
interface SettingsDoc {
	id: string;
	siteName: string;
	siteDescription?: string | null;
	twitterHandle?: string | null;
	facebookUrl?: string | null;
	linkedinUrl?: string | null;
	analyticsId?: string | null;
	maintenanceMode?: boolean | null;
	notifications?: {
		emailEnabled?: boolean | null;
		emailFrom?: string | null;
	} | null;
}

test.describe('Named tabs (nested data)', { tag: ['@collection', '@crud'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('seeded settings have named tab data as nested object', async ({ request }) => {
		const response = await request.get('/api/settings?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: SettingsDoc[] };

		// Main settings — has notifications nested data from named tab
		const main = data.docs.find((d) => d.siteName === 'Test CMS Site');
		expect(main, 'Main settings should exist').toBeTruthy();

		// Named tab data is nested under 'notifications'
		expect(main?.notifications).toBeTruthy();
		expect(main?.notifications?.emailEnabled).toBe(true);
		expect(main?.notifications?.emailFrom).toBe('noreply@test.com');

		// Unnamed tab fields remain flat at the root level
		expect(main?.siteName).toBe('Test CMS Site');
		expect(main?.twitterHandle).toBe('@testcms');

		// Layout field name 'settingsTabs' should NOT exist in data
		const mainRaw = main as unknown as Record<string, unknown>;
		expect(mainRaw['settingsTabs']).toBeUndefined();
	});

	test('minimal seeded settings have no notifications data', async ({ request }) => {
		const response = await request.get('/api/settings?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: SettingsDoc[] };
		const minimal = data.docs.find((d) => d.siteName === 'Minimal Site');
		expect(minimal, 'Minimal settings should exist').toBeTruthy();

		// Minimal doc has no notifications set — should be null or undefined
		const notifications = minimal?.notifications;
		expect(
			notifications === null || notifications === undefined,
			`Minimal doc should have null/undefined notifications, got: ${JSON.stringify(notifications)}`,
		).toBe(true);
	});

	test('can create settings with named tab nested data', async ({ request }) => {
		const uniqueName = `Named Tab Create ${Date.now()}`;

		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				twitterHandle: '@namedtab',
				notifications: {
					emailEnabled: false,
					emailFrom: 'admin@test.com',
				},
			},
		});
		expect(createResponse.status()).toBe(201);

		const body = (await createResponse.json()) as { doc: SettingsDoc };
		const created = body.doc;

		// Unnamed tab fields at root
		expect(created.siteName).toBe(uniqueName);
		expect(created.twitterHandle).toBe('@namedtab');

		// Named tab data nested
		expect(created.notifications).toBeTruthy();
		expect(created.notifications?.emailEnabled).toBe(false);
		expect(created.notifications?.emailFrom).toBe('admin@test.com');

		// Verify persistence via GET
		const getResponse = await request.get(`/api/settings/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: SettingsDoc };
		expect(getBody.doc.notifications?.emailEnabled).toBe(false);
		expect(getBody.doc.notifications?.emailFrom).toBe('admin@test.com');

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('can update named tab fields via PATCH', async ({ request }) => {
		const uniqueName = `Named Tab Update ${Date.now()}`;

		// Create with initial data
		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				notifications: {
					emailEnabled: false,
					emailFrom: 'original@test.com',
				},
			},
		});
		expect(createResponse.status()).toBe(201);

		const createBody = (await createResponse.json()) as { doc: SettingsDoc };
		const created = createBody.doc;

		// Update named tab nested data
		const updateResponse = await request.patch(`/api/settings/${created.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				notifications: {
					emailEnabled: true,
					emailFrom: 'updated@test.com',
				},
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update via GET
		const getResponse = await request.get(`/api/settings/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: SettingsDoc };
		const updated = getBody.doc;

		// Named tab fields updated
		expect(updated.notifications?.emailEnabled).toBe(true);
		expect(updated.notifications?.emailFrom).toBe('updated@test.com');

		// Unnamed tab fields unchanged
		expect(updated.siteName).toBe(uniqueName);

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('named tab data survives full round-trip', async ({ request }) => {
		const uniqueName = `Named Tab Roundtrip ${Date.now()}`;

		// Create with both unnamed (flat) and named (nested) tab data
		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				siteDescription: 'Roundtrip test',
				twitterHandle: '@roundtrip',
				facebookUrl: 'https://facebook.com/roundtrip',
				linkedinUrl: 'https://linkedin.com/roundtrip',
				analyticsId: 'GA-RT',
				maintenanceMode: true,
				notifications: {
					emailEnabled: true,
					emailFrom: 'roundtrip@test.com',
				},
			},
		});
		expect(createResponse.status()).toBe(201);

		const createBody = (await createResponse.json()) as { doc: SettingsDoc };
		const id = createBody.doc.id;

		// Update only a flat field — should not affect nested data
		const updateResponse = await request.patch(`/api/settings/${id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteDescription: 'Updated description',
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// GET and verify everything
		const getResponse = await request.get(`/api/settings/${id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: SettingsDoc };
		const doc = getBody.doc;

		// Flat fields (unnamed tabs + collapsible)
		expect(doc.siteName).toBe(uniqueName);
		expect(doc.siteDescription).toBe('Updated description');
		expect(doc.twitterHandle).toBe('@roundtrip');
		expect(doc.facebookUrl).toBe('https://facebook.com/roundtrip');
		expect(doc.linkedinUrl).toBe('https://linkedin.com/roundtrip');
		expect(doc.analyticsId).toBe('GA-RT');
		expect(doc.maintenanceMode).toBe(true);

		// Named tab nested data preserved after unrelated update
		expect(doc.notifications?.emailEnabled).toBe(true);
		expect(doc.notifications?.emailFrom).toBe('roundtrip@test.com');

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${id}`);
		expect(verifyResponse.ok()).toBe(false);
	});
});

/**
 * Helper: get the seeded "Test CMS Site" settings document ID.
 */
async function getSeededSettingsId(page: Page): Promise<string> {
	const response = await page.request.get('/api/settings?limit=10');
	expect(response.ok()).toBe(true);
	const data = (await response.json()) as { docs: SettingsDoc[] };
	const main = data.docs.find((d) => d.siteName === 'Test CMS Site');
	expect(main, 'Seeded "Test CMS Site" doc must exist').toBeTruthy();
	return main!.id;
}

/**
 * Helper: navigate to settings edit page and wait for form ready.
 */
async function gotoSettingsEdit(page: Page, id: string, queryString = ''): Promise<void> {
	const url = `/admin/collections/settings/${id}/edit${queryString}`;
	await page.goto(url);
	await page.waitForLoadState('domcontentloaded');
	await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible({
		timeout: 15000,
	});
}

test.describe(
	'Tab UI — default selection and query param persistence',
	{ tag: ['@collection', '@tabs'] },
	() => {
		test('should default to the first tab (General) on load', async ({ authenticatedPage }) => {
			const id = await getSeededSettingsId(authenticatedPage);
			await gotoSettingsEdit(authenticatedPage, id);

			// "General" tab should be selected (aria-selected="true")
			const generalTab = authenticatedPage.getByRole('tab', { name: 'General' });
			await expect(generalTab).toHaveAttribute('aria-selected', 'true');

			// Other tabs should be deselected
			await expect(authenticatedPage.getByRole('tab', { name: 'Social' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
			await expect(authenticatedPage.getByRole('tab', { name: 'Notifications' })).toHaveAttribute(
				'aria-selected',
				'false',
			);

			// General tab content should be visible — siteName input
			await expect(authenticatedPage.locator('input#field-siteName')).toBeVisible();

			// URL should NOT have a settingsTabs query param (no URL pollution on default)
			const url = new URL(authenticatedPage.url());
			expect(url.searchParams.has('settingsTabs')).toBe(false);
		});

		test('clicking Social tab updates URL query param', async ({ authenticatedPage }) => {
			const id = await getSeededSettingsId(authenticatedPage);
			await gotoSettingsEdit(authenticatedPage, id);

			// Click on the Social tab
			await authenticatedPage.getByRole('tab', { name: 'Social' }).click();

			// URL should update with ?settingsTabs=Social
			await expect
				.poll(() => new URL(authenticatedPage.url()).searchParams.get('settingsTabs'), {
					timeout: 5000,
				})
				.toBe('Social');

			// Social tab should now be selected
			await expect(authenticatedPage.getByRole('tab', { name: 'Social' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// General tab should be deselected
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
		});

		test('clicking Notifications (named) tab updates URL query param', async ({
			authenticatedPage,
		}) => {
			const id = await getSeededSettingsId(authenticatedPage);
			await gotoSettingsEdit(authenticatedPage, id);

			// Click on the Notifications tab (named tab)
			await authenticatedPage.getByRole('tab', { name: 'Notifications' }).click();

			// URL should update with ?settingsTabs=Notifications
			await expect
				.poll(() => new URL(authenticatedPage.url()).searchParams.get('settingsTabs'), {
					timeout: 5000,
				})
				.toBe('Notifications');

			// Notifications tab should be selected
			await expect(authenticatedPage.getByRole('tab', { name: 'Notifications' })).toHaveAttribute(
				'aria-selected',
				'true',
			);
		});

		test('refreshing page preserves selected tab from query param', async ({
			authenticatedPage,
		}) => {
			const id = await getSeededSettingsId(authenticatedPage);

			// Navigate directly with ?settingsTabs=Social
			await gotoSettingsEdit(authenticatedPage, id, '?settingsTabs=Social');

			// Social tab should be pre-selected
			await expect(authenticatedPage.getByRole('tab', { name: 'Social' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// General tab should NOT be selected
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
		});

		test('navigating with query param for named tab pre-selects it', async ({
			authenticatedPage,
		}) => {
			const id = await getSeededSettingsId(authenticatedPage);

			// Navigate directly with ?settingsTabs=Notifications
			await gotoSettingsEdit(authenticatedPage, id, '?settingsTabs=Notifications');

			// Notifications tab should be pre-selected
			await expect(authenticatedPage.getByRole('tab', { name: 'Notifications' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// Other tabs should be deselected
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
			await expect(authenticatedPage.getByRole('tab', { name: 'Social' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
		});

		test('invalid query param value falls back to first tab', async ({ authenticatedPage }) => {
			const id = await getSeededSettingsId(authenticatedPage);

			// Navigate with an invalid tab name
			await gotoSettingsEdit(authenticatedPage, id, '?settingsTabs=Nonexistent');

			// Should fall back to General (first tab)
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// General tab content should be visible
			await expect(authenticatedPage.locator('input#field-siteName')).toBeVisible();
		});

		test('tab selection round-trip: click, reload, verify persistence', async ({
			authenticatedPage,
		}) => {
			const id = await getSeededSettingsId(authenticatedPage);
			await gotoSettingsEdit(authenticatedPage, id);

			// Verify starting on General tab
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// Click Social tab
			await authenticatedPage.getByRole('tab', { name: 'Social' }).click();

			// Wait for URL to update
			await expect
				.poll(() => new URL(authenticatedPage.url()).searchParams.get('settingsTabs'), {
					timeout: 5000,
				})
				.toBe('Social');

			// Reload the page
			await authenticatedPage.reload();
			await authenticatedPage.waitForLoadState('domcontentloaded');
			await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeVisible({
				timeout: 15000,
			});

			// Social tab should still be selected after reload
			await expect(authenticatedPage.getByRole('tab', { name: 'Social' })).toHaveAttribute(
				'aria-selected',
				'true',
			);

			// General tab should NOT be selected
			await expect(authenticatedPage.getByRole('tab', { name: 'General' })).toHaveAttribute(
				'aria-selected',
				'false',
			);
		});
	},
);

import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Layout fields E2E tests.
 * Verifies that collections using layout fields (tabs, collapsible, row)
 * store data correctly as flat fields. Layout fields organize the admin UI
 * but don't affect the data storage structure.
 */

/** Settings document shape */
interface SettingsDoc {
	id: string;
	siteName: string;
	siteDescription?: string | null;
	twitterHandle?: string | null;
	facebookUrl?: string | null;
	linkedinUrl?: string | null;
	analyticsId?: string | null;
	maintenanceMode?: boolean | null;
}

test.describe('Layout fields (tabs, collapsible, row)', () => {
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

	test('seeded settings have flat data fields from layout containers', async ({ request }) => {
		const response = await request.get('/api/settings?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: SettingsDoc[] };

		expect(data.docs.length).toBeGreaterThanOrEqual(2);

		// Main settings - has all fields populated
		const main = data.docs.find((d) => d.siteName === 'Test CMS Site');
		expect(main, 'Main settings should exist').toBeTruthy();
		expect(typeof main?.id).toBe('string');
		expect(main?.id?.length).toBeGreaterThan(0);

		// Fields from the "General" tab
		expect(main?.siteName).toBe('Test CMS Site');
		expect(main?.siteDescription).toBe('A test site for E2E layout field testing.');

		// Fields from the "Social" tab, inside a row layout
		expect(main?.twitterHandle).toBe('@testcms');
		expect(main?.facebookUrl).toBe('https://facebook.com/testcms');
		expect(main?.linkedinUrl).toBe('https://linkedin.com/company/testcms');

		// Fields from the collapsible section
		expect(main?.analyticsId).toBe('GA-12345');
		expect(main?.maintenanceMode).toBe(false);

		// Minimal settings - only required field
		const minimal = data.docs.find((d) => d.siteName === 'Minimal Site');
		expect(minimal, 'Minimal settings should exist').toBeTruthy();
		expect(minimal?.siteName).toBe('Minimal Site');
		// Optional fields should be null/undefined
		expect(minimal?.siteDescription ?? null).toBeNull();
		expect(minimal?.twitterHandle ?? null).toBeNull();
	});

	test('can create settings with fields from all layout containers', async ({ request }) => {
		const uniqueName = `Layout Test Site ${Date.now()}`;

		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				siteDescription: 'Created via API to test layout fields.',
				twitterHandle: '@created',
				facebookUrl: 'https://facebook.com/created',
				linkedinUrl: 'https://linkedin.com/created',
				analyticsId: 'GA-99999',
				maintenanceMode: true,
			},
		});
		expect(createResponse.ok()).toBe(true);

		const body = (await createResponse.json()) as { doc: SettingsDoc };
		const created = body.doc;

		// Verify all fields stored correctly (flat, not nested under layout names)
		expect(created.siteName).toBe(uniqueName);
		expect(created.siteDescription).toBe('Created via API to test layout fields.');
		expect(created.twitterHandle).toBe('@created');
		expect(created.facebookUrl).toBe('https://facebook.com/created');
		expect(created.linkedinUrl).toBe('https://linkedin.com/created');
		expect(created.analyticsId).toBe('GA-99999');
		expect(created.maintenanceMode).toBe(true);

		// Verify persistence via GET
		const getResponse = await request.get(`/api/settings/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: SettingsDoc };
		const fetched = getBody.doc;
		expect(fetched.siteName).toBe(uniqueName);
		expect(fetched.twitterHandle).toBe('@created');
		expect(fetched.analyticsId).toBe('GA-99999');
		expect(fetched.maintenanceMode).toBe(true);

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('can update individual fields across different layout containers', async ({ request }) => {
		const uniqueName = `Update Layout Test ${Date.now()}`;

		// Create
		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				twitterHandle: '@original',
				analyticsId: 'GA-111',
				maintenanceMode: false,
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as { doc: SettingsDoc };
		const created = createBody.doc;

		// Update fields from different layout containers in one PATCH
		const updateResponse = await request.patch(`/api/settings/${created.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				// From General tab
				siteDescription: 'Updated description',
				// From Social tab (inside row)
				twitterHandle: '@updated',
				// From collapsible
				maintenanceMode: true,
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update via GET
		const getResponse = await request.get(`/api/settings/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: SettingsDoc };
		const updated = getBody.doc;

		// Updated fields
		expect(updated.siteDescription).toBe('Updated description');
		expect(updated.twitterHandle).toBe('@updated');
		expect(updated.maintenanceMode).toBe(true);

		// Unchanged fields
		expect(updated.siteName).toBe(uniqueName);
		expect(updated.analyticsId).toBe('GA-111');

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('layout field names are not stored as data columns', async ({ request }) => {
		const uniqueName = `No Layout Data Test ${Date.now()}`;

		// Create a normal settings doc, then verify layout field names don't appear
		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				siteName: uniqueName,
				twitterHandle: '@test',
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as { doc: Record<string, unknown> };
		const created = createBody.doc;

		// Layout field names should NOT appear as data keys in the response
		// 'settingsTabs' is the tabs layout field name
		// 'socialRow' is the row layout field name
		// 'advanced' is the collapsible layout field name
		expect(created['settingsTabs']).toBeUndefined();
		expect(created['socialRow']).toBeUndefined();
		expect(created['advanced']).toBeUndefined();

		// Verify via a fresh GET that layout keys aren't persisted
		const getResponse = await request.get(`/api/settings/${created['id']}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as { doc: Record<string, unknown> };
		const fetched = getBody.doc;
		expect(fetched['settingsTabs']).toBeUndefined();
		expect(fetched['socialRow']).toBeUndefined();
		expect(fetched['advanced']).toBeUndefined();

		// Data fields should be present and correct
		expect(fetched['siteName']).toBe(uniqueName);
		expect(fetched['twitterHandle']).toBe('@test');

		// Verify the response only contains expected column names (no layout field names)
		const expectedKeys = new Set([
			'id',
			'createdAt',
			'updatedAt',
			'siteName',
			'siteDescription',
			'twitterHandle',
			'facebookUrl',
			'linkedinUrl',
			'analyticsId',
			'maintenanceMode',
		]);
		for (const key of Object.keys(fetched)) {
			expect(expectedKeys.has(key), `Unexpected key "${key}" in response`).toBe(true);
		}

		// Clean up
		const deleteResponse = await request.delete(`/api/settings/${created['id']}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/settings/${created['id']}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('required field validation works through layout containers', async ({ request }) => {
		// siteName is required and lives inside a tabs layout field.
		// Server-side validation must flatten through layout fields to enforce this.
		const createResponse = await request.post('/api/settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				// Omit siteName (required) - only provide optional fields
				twitterHandle: '@nositename',
				analyticsId: 'GA-000',
			},
		});

		// Should fail validation because siteName is required
		expect(createResponse.ok()).toBe(false);
		expect(createResponse.status()).toBe(400);
	});
});

import { test, expect } from '../fixtures';

/**
 * Email Templates E2E Tests
 *
 * Tests the email-templates collection added by the email plugin.
 * Verifies API CRUD, access control, seeded system templates,
 * and admin UI integration.
 *
 * Prerequisites:
 * - Server running with email plugin enabled
 * - System templates seeded (password-reset, verification)
 */

test.describe('Email Templates — API', { tag: ['@api', '@crud'] }, () => {
	test.describe('Unauthenticated Access', () => {
		test('GET /api/email-templates should deny unauthenticated read', async ({ request }) => {
			const response = await request.get('/api/email-templates');
			expect(response.status()).toBe(403);
		});

		test('POST /api/email-templates should deny unauthenticated create', async ({ request }) => {
			const response = await request.post('/api/email-templates', {
				data: {
					name: 'Unauthorized Template',
					slug: 'unauthorized',
					subject: 'Test',
				},
			});
			expect(response.status()).toBe(403);
		});

		test('PATCH /api/email-templates/:id should deny unauthenticated update', async ({
			request,
		}) => {
			const response = await request.patch('/api/email-templates/some-id', {
				data: { name: 'Updated' },
			});
			expect(response.status()).toBe(403);
		});

		test('DELETE /api/email-templates/:id should deny unauthenticated delete', async ({
			request,
		}) => {
			const response = await request.delete('/api/email-templates/some-id');
			expect(response.status()).toBe(403);
		});
	});

	test.describe('Authenticated CRUD (Admin)', () => {
		test('should list email templates including seeded system templates', async ({
			authenticatedPage,
		}) => {
			const response = await authenticatedPage.request.get('/api/email-templates');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{ name: string; slug: string; isSystem: boolean }>;
				totalDocs: number;
			};
			expect(body.totalDocs).toBeGreaterThanOrEqual(2);

			// Verify seeded system templates exist
			const slugs = body.docs.map((d) => d.slug);
			expect(slugs).toContain('password-reset');
			expect(slugs).toContain('verification');

			// Verify system flag
			const passwordReset = body.docs.find((d) => d.slug === 'password-reset');
			expect(passwordReset).toBeDefined();
			expect(passwordReset!.isSystem).toBe(true);
			expect(passwordReset!.name).toBe('Password Reset');

			const verification = body.docs.find((d) => d.slug === 'verification');
			expect(verification).toBeDefined();
			expect(verification!.isSystem).toBe(true);
			expect(verification!.name).toBe('Email Verification');
		});

		test('should create a new email template', async ({ authenticatedPage }) => {
			const timestamp = Date.now();
			const templateData = {
				name: `Welcome Email ${timestamp}`,
				slug: `welcome-${timestamp}`,
				subject: 'Welcome to {{appName}}!',
				emailBlocks: [
					{
						id: `header-${timestamp}`,
						type: 'header',
						data: { title: 'Welcome!', alignment: 'left' },
					},
					{
						id: `text-${timestamp}`,
						type: 'text',
						data: { content: 'Thank you for joining {{appName}}.', fontSize: 16 },
					},
				],
				isSystem: false,
			};

			const createResponse = await authenticatedPage.request.post('/api/email-templates', {
				data: templateData,
			});
			expect(createResponse.status()).toBe(201);

			const created = (await createResponse.json()) as {
				doc: { id: string; name: string; slug: string; subject: string; emailBlocks: unknown[] };
			};
			expect(created.doc.name).toBe(templateData.name);
			expect(created.doc.slug).toBe(templateData.slug);
			expect(created.doc.subject).toBe(templateData.subject);
			expect(Array.isArray(created.doc.emailBlocks)).toBe(true);
			expect(created.doc.emailBlocks).toHaveLength(2);

			// Cleanup: delete the created template
			const deleteResponse = await authenticatedPage.request.delete(
				`/api/email-templates/${created.doc.id}`,
			);
			expect(deleteResponse.ok()).toBe(true);
		});

		test('should read a single email template by ID', async ({ authenticatedPage }) => {
			// Get the list to find a seeded template ID
			const listResponse = await authenticatedPage.request.get('/api/email-templates');
			const list = (await listResponse.json()) as {
				docs: Array<{ id: string; slug: string }>;
			};
			const template = list.docs.find((d) => d.slug === 'password-reset');
			expect(template).toBeDefined();

			// Read by ID
			const response = await authenticatedPage.request.get(`/api/email-templates/${template!.id}`);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				doc: { slug: string; subject: string; emailBlocks: unknown[]; isSystem: boolean };
			};
			expect(body.doc.slug).toBe('password-reset');
			expect(body.doc.subject).toContain('{{appName}}');
			expect(body.doc.isSystem).toBe(true);
			expect(Array.isArray(body.doc.emailBlocks)).toBe(true);
			expect(body.doc.emailBlocks.length).toBeGreaterThan(0);
		});

		test('should update an email template', async ({ authenticatedPage }) => {
			// Create a template to update
			const timestamp = Date.now();
			const createResponse = await authenticatedPage.request.post('/api/email-templates', {
				data: {
					name: `Update Test ${timestamp}`,
					slug: `update-test-${timestamp}`,
					subject: 'Original Subject',
				},
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };

			// Update it
			const updateResponse = await authenticatedPage.request.patch(
				`/api/email-templates/${created.doc.id}`,
				{
					data: {
						subject: 'Updated Subject — {{appName}}',
					},
				},
			);
			expect(updateResponse.ok()).toBe(true);

			// Verify update persisted
			const readResponse = await authenticatedPage.request.get(
				`/api/email-templates/${created.doc.id}`,
			);
			const updated = (await readResponse.json()) as { doc: { subject: string } };
			expect(updated.doc.subject).toBe('Updated Subject — {{appName}}');

			// Cleanup
			await authenticatedPage.request.delete(`/api/email-templates/${created.doc.id}`);
		});

		test('should delete a non-system email template', async ({ authenticatedPage }) => {
			// Create a template to delete
			const timestamp = Date.now();
			const createResponse = await authenticatedPage.request.post('/api/email-templates', {
				data: {
					name: `Delete Test ${timestamp}`,
					slug: `delete-test-${timestamp}`,
					subject: 'To be deleted',
				},
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };

			// Delete it
			const deleteResponse = await authenticatedPage.request.delete(
				`/api/email-templates/${created.doc.id}`,
			);
			expect(deleteResponse.ok()).toBe(true);

			// Verify it no longer exists
			const readResponse = await authenticatedPage.request.get(
				`/api/email-templates/${created.doc.id}`,
			);
			expect(readResponse.status()).toBe(404);
		});

		test('should enforce unique slug constraint', async ({ authenticatedPage }) => {
			const timestamp = Date.now();
			const slug = `unique-test-${timestamp}`;

			// Create first template
			const first = await authenticatedPage.request.post('/api/email-templates', {
				data: { name: 'First', slug, subject: 'First' },
			});
			expect(first.status()).toBe(201);
			const firstDoc = (await first.json()) as { doc: { id: string } };

			// Try to create second with same slug
			const second = await authenticatedPage.request.post('/api/email-templates', {
				data: { name: 'Second', slug, subject: 'Second' },
			});
			// Should fail with validation error (400 or 409)
			expect(second.ok()).toBe(false);

			// Cleanup
			await authenticatedPage.request.delete(`/api/email-templates/${firstDoc.doc.id}`);
		});
	});

	test.describe('System Template Protection', { tag: ['@security'] }, () => {
		test('should reject deletion of system templates', async ({ authenticatedPage }) => {
			// Find the password-reset system template
			const listResponse = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=password-reset',
			);
			expect(listResponse.ok()).toBe(true);
			const list = (await listResponse.json()) as { docs: Array<{ id: string }> };
			expect(list.docs).toHaveLength(1);
			const templateId = list.docs[0].id;

			// Attempt to delete it — should be rejected by beforeDelete hook
			const deleteResponse = await authenticatedPage.request.delete(
				`/api/email-templates/${templateId}`,
			);
			expect(deleteResponse.ok()).toBe(false);

			// Verify the template still exists
			const readResponse = await authenticatedPage.request.get(
				`/api/email-templates/${templateId}`,
			);
			expect(readResponse.ok()).toBe(true);
		});

		test('should reject changing isSystem to false on system templates', async ({
			authenticatedPage,
		}) => {
			const listResponse = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=password-reset',
			);
			const list = (await listResponse.json()) as { docs: Array<{ id: string }> };
			const templateId = list.docs[0].id;

			const updateResponse = await authenticatedPage.request.patch(
				`/api/email-templates/${templateId}`,
				{ data: { isSystem: false } },
			);
			expect(updateResponse.ok()).toBe(false);
		});

		test('should reject changing slug on system templates', async ({ authenticatedPage }) => {
			const listResponse = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=password-reset',
			);
			const list = (await listResponse.json()) as { docs: Array<{ id: string }> };
			const templateId = list.docs[0].id;

			const updateResponse = await authenticatedPage.request.patch(
				`/api/email-templates/${templateId}`,
				{ data: { slug: 'hacked-slug' } },
			);
			expect(updateResponse.ok()).toBe(false);
		});

		test('should allow updating name and subject on system templates', async ({
			authenticatedPage,
		}) => {
			const listResponse = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=password-reset',
			);
			const list = (await listResponse.json()) as {
				docs: Array<{ id: string; name: string }>;
			};
			const templateId = list.docs[0].id;
			const originalName = list.docs[0].name;

			// Updating name on a system template should succeed
			const updateResponse = await authenticatedPage.request.patch(
				`/api/email-templates/${templateId}`,
				{ data: { name: originalName } },
			);
			expect(updateResponse.ok()).toBe(true);
		});
	});

	test.describe('Seeded System Templates', () => {
		test('password-reset template has correct structure', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=password-reset',
			);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{
					name: string;
					slug: string;
					subject: string;
					emailBlocks: unknown[];
					isSystem: boolean;
				}>;
			};
			expect(body.docs).toHaveLength(1);

			const template = body.docs[0];
			expect(template.name).toBe('Password Reset');
			expect(template.slug).toBe('password-reset');
			expect(template.subject).toContain('{{appName}}');
			expect(template.subject).toContain('Reset');
			expect(template.isSystem).toBe(true);
			expect(Array.isArray(template.emailBlocks)).toBe(true);
			expect(template.emailBlocks.length).toBeGreaterThan(0);
		});

		test('verification template has correct structure', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.get(
				'/api/email-templates?where[slug][equals]=verification',
			);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{
					name: string;
					slug: string;
					subject: string;
					emailBlocks: unknown[];
					isSystem: boolean;
				}>;
			};
			expect(body.docs).toHaveLength(1);

			const template = body.docs[0];
			expect(template.name).toBe('Email Verification');
			expect(template.slug).toBe('verification');
			expect(template.subject).toContain('{{appName}}');
			expect(template.subject).toContain('Verify');
			expect(template.isSystem).toBe(true);
			expect(Array.isArray(template.emailBlocks)).toBe(true);
			expect(template.emailBlocks.length).toBeGreaterThan(0);
		});
	});
});

test.describe('Email Templates — Admin UI', { tag: ['@admin'] }, () => {
	test('email templates collection appears in admin sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for sidebar to be visible
		await expect(authenticatedPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
			timeout: 10000,
		});

		// Look for the Email Templates link in the sidebar
		const emailTemplatesLink = authenticatedPage.getByRole('link', {
			name: /email templates/i,
		});
		await expect(emailTemplatesLink).toBeVisible({ timeout: 10000 });
	});

	test('should navigate to email templates list page', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/email-templates');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Should show the collection list heading
		await expect(authenticatedPage.getByRole('heading', { name: /email templates/i })).toBeVisible({
			timeout: 10000,
		});
	});

	test('should display seeded system templates in list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/email-templates');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for data to load
		await expect(authenticatedPage.getByRole('heading', { name: /email templates/i })).toBeVisible({
			timeout: 10000,
		});

		// Should see seeded templates
		await expect(authenticatedPage.getByText('Password Reset')).toBeVisible({ timeout: 10000 });
		await expect(authenticatedPage.getByText('Email Verification')).toBeVisible({
			timeout: 10000,
		});
	});

	test('should navigate to create new email template form', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/email-templates/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Should show the create form
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible({ timeout: 10000 });

		// Should show collection-specific fields
		const nameInput = authenticatedPage.locator('input#field-name');
		await expect(nameInput).toBeVisible();

		const slugInput = authenticatedPage.locator('input#field-slug');
		await expect(slugInput).toBeVisible();

		const subjectInput = authenticatedPage.locator('input#field-subject');
		await expect(subjectInput).toBeVisible();
	});
});

test.describe('Email Templates — Preview API', { tag: ['@api'] }, () => {
	test('GET preview should render email HTML from saved data', async ({ authenticatedPage }) => {
		// Find the password-reset template ID
		const listResponse = await authenticatedPage.request.get(
			'/api/email-templates?where[slug][equals]=password-reset',
		);
		expect(listResponse.ok()).toBe(true);
		const list = (await listResponse.json()) as { docs: Array<{ id: string }> };
		expect(list.docs.length).toBe(1);
		const templateId = list.docs[0].id;

		// GET preview should return rendered email HTML
		const previewResponse = await authenticatedPage.request.get(
			`/api/email-templates/${templateId}/preview`,
		);
		expect(previewResponse.ok()).toBe(true);
		const html = await previewResponse.text();
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('role="presentation"');
	});

	test('POST preview should render email HTML from request body data', async ({
		authenticatedPage,
	}) => {
		// Find the password-reset template ID (needed for the URL)
		const listResponse = await authenticatedPage.request.get(
			'/api/email-templates?where[slug][equals]=password-reset',
		);
		const list = (await listResponse.json()) as { docs: Array<{ id: string }> };
		const templateId = list.docs[0].id;

		// POST with custom email blocks should render those blocks (not DB data)
		const customBlocks = [
			{
				type: 'text',
				id: 'test-1',
				data: { content: 'Custom POST preview content', fontSize: 20 },
			},
		];
		const postResponse = await authenticatedPage.request.post(
			`/api/email-templates/${templateId}/preview`,
			{
				data: { data: { emailBlocks: customBlocks } },
			},
		);
		expect(postResponse.ok()).toBe(true);
		const html = await postResponse.text();
		expect(html).toContain('Custom POST preview content');
		expect(html).toContain('font-size: 20px');
	});
});

test.describe('Email Templates — Access Control', { tag: ['@security'] }, () => {
	test('editor role should be denied access to email templates', async ({ editorPage }) => {
		const response = await editorPage.request.get('/api/email-templates');
		expect(response.status()).toBe(403);
	});

	test('viewer role should be denied access to email templates', async ({ viewerPage }) => {
		const response = await viewerPage.request.get('/api/email-templates');
		expect(response.status()).toBe(403);
	});
});

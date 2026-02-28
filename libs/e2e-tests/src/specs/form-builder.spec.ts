import { test, expect, TEST_CREDENTIALS, checkA11y } from '../fixtures';

/**
 * Form builder plugin E2E tests.
 *
 * Covers:
 * - Admin UI: dashboard navigation, forms/submissions collections
 * - Public API: schema retrieval, validation, submission
 * - Form rendering: headed-mode block on pages
 * - Live page inline editing: relationship dropdown in InlineBlockEditDialog
 * - Accessibility: axe audit on rendered form
 *
 * Seed data (from momentum.config.ts):
 * - Form "Contact Us" (slug: contact-us, status: published)
 * - Page "Contact Page" (slug: contact) with hero + form block
 */

/** Generate a collision-resistant unique slug. */
function uniqueSlug(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Form builder plugin', { tag: ['@form-builder'] }, () => {
	/** Helper: navigate to the Contact Us form edit page and wait for schema editor. */
	async function navigateToContactFormEdit(page: import('@playwright/test').Page): Promise<void> {
		await page.goto('/admin/collections/forms');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('mcms-table')).toBeVisible({ timeout: 10000 });
		await page
			.locator('mcms-table-cell')
			.filter({ hasText: /Contact Us/i })
			.first()
			.click();

		// Wait for form schema editor to load (instead of raw JSON input)
		await expect(page.locator('[data-testid="form-schema-editor"]')).toBeVisible({
			timeout: 15000,
		});
	}

	// ─── Admin UI Tests ────────────────────────────────────────────────

	test.describe('Admin UI', { tag: ['@admin'] }, () => {
		test('should show Forms in the Content group on the admin dashboard', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const contentSection = authenticatedPage.getByRole('region', { name: 'Content' });
			await expect(contentSection).toBeVisible();
			await expect(contentSection.getByRole('heading', { name: 'Forms' })).toBeVisible();
		});

		test('should navigate from dashboard to forms list via sidebar', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const nav = authenticatedPage.getByLabel('Main navigation');
			await nav.getByRole('link', { name: 'Forms' }).click();

			await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/forms/, {
				timeout: 10000,
			});
			await expect(authenticatedPage.getByRole('heading', { name: 'Forms' })).toBeVisible();
		});

		test('should show Form Submissions in sidebar', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const nav = authenticatedPage.getByLabel('Main navigation');
			await expect(
				nav.getByRole('link', { name: /Form Submissions|^Submissions$/i }).first(),
			).toBeVisible();
		});

		test('should show seeded Contact Us form in the forms list', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/collections/forms');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 10000 });
			await expect(
				authenticatedPage
					.locator('mcms-table-cell')
					.filter({ hasText: /Contact Us/i })
					.first(),
			).toBeVisible();
		});

		test('should show Contact Us form edit page with Form and Settings tabs', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			// Should have two tabs: "Form" and "Settings"
			const tabsList = authenticatedPage.locator('mcms-tabs-list');
			await expect(tabsList).toBeVisible();
			await expect(tabsList.getByText('Form', { exact: true })).toBeVisible();
			await expect(tabsList.getByText('Settings', { exact: true })).toBeVisible();

			// "Form" tab should be active by default — schema editor should be visible
			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');
			await expect(editor).toBeVisible();
		});

		test('should show Settings tab with description, success message, and honeypot fields', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			// Switch to Settings tab
			const tabsList = authenticatedPage.locator('mcms-tabs-list');
			await tabsList.getByText('Settings', { exact: true }).click();

			// Settings fields should be visible
			await expect(authenticatedPage.locator('#description')).toBeVisible({ timeout: 5000 });
			await expect(authenticatedPage.locator('#successMessage')).toBeVisible();
			await expect(authenticatedPage.locator('#redirectUrl')).toBeVisible();
			await expect(authenticatedPage.locator('#honeypot')).toBeVisible();

			// Schema editor should NOT be visible on the Settings tab
			await expect(
				authenticatedPage.locator('[data-testid="form-schema-editor"]'),
			).not.toBeVisible();

			// Switch back to Form tab — schema editor should reappear
			await tabsList.getByText('Form', { exact: true }).click();
			await expect(authenticatedPage.locator('[data-testid="form-schema-editor"]')).toBeVisible({
				timeout: 5000,
			});
		});
	});

	// ─── API Endpoint Tests ────────────────────────────────────────────

	test.describe('API Endpoints', { tag: ['@api'] }, () => {
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

		test('should create a form via API', async ({ request }) => {
			const slug = uniqueSlug('e2e-test');
			const response = await request.post('/api/forms', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `E2E Test Form ${slug}`,
					slug,
					status: 'published',
					schema: {
						id: slug,
						fields: [
							{
								name: 'email',
								type: 'email',
								label: 'Email',
								required: true,
							},
						],
					},
					honeypot: false,
					submissionCount: 0,
				},
			});

			expect(response.status()).toBe(201);

			const body = (await response.json()) as {
				doc: { id: string; title: string; slug: string };
			};
			expect(body.doc.title).toContain('E2E Test Form');
			expect(body.doc.slug).toBe(slug);

			// Clean up
			const deleteResponse = await request.delete(`/api/forms/${body.doc.id}`);
			expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
		});

		test('should retrieve form schema via public endpoint', async ({ request }) => {
			const response = await request.get('/api/forms/contact-us/schema');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				id: string;
				slug: string;
				title: string;
				schema: { fields: Array<{ name: string; type: string }> };
			};

			expect(body.slug).toBe('contact-us');
			expect(body.title).toBe('Contact Us');
			expect(body.schema).toBeDefined();
			expect(Array.isArray(body.schema.fields)).toBe(true);
			expect(body.schema.fields.length).toBeGreaterThan(0);

			// Verify all expected fields from the seeded schema
			const fieldNames = body.schema.fields.map((f) => f.name);
			expect(fieldNames).toContain('name');
			expect(fieldNames).toContain('email');
			expect(fieldNames).toContain('subject');
			expect(fieldNames).toContain('message');

			// Verify field types match the seeded schema
			const fieldTypes = Object.fromEntries(body.schema.fields.map((f) => [f.name, f.type]));
			expect(fieldTypes['name']).toBe('text');
			expect(fieldTypes['email']).toBe('email');
			expect(fieldTypes['subject']).toBe('select');
			expect(fieldTypes['message']).toBe('textarea');
		});

		test('should return 404 for non-existent form schema', async ({ request }) => {
			const response = await request.get('/api/forms/nonexistent-form-slug/schema');
			expect(response.status()).toBe(404);

			const body = (await response.json()) as { error: string };
			expect(body.error).toBe('Form not found');
		});

		test('should return 404 for draft form schema (public)', async ({ request }) => {
			const slug = uniqueSlug('draft-form');
			const createResponse = await request.post('/api/forms', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Draft Form ${slug}`,
					slug,
					status: 'draft',
					schema: { id: slug, fields: [] },
					honeypot: false,
					submissionCount: 0,
				},
			});
			expect(createResponse.status()).toBe(201);

			const created = (await createResponse.json()) as { doc: { id: string; slug: string } };

			// Public schema endpoint should not find draft forms
			const schemaResponse = await request.get(`/api/forms/${created.doc.slug}/schema`);
			expect(schemaResponse.status()).toBe(404);

			// Clean up
			const deleteResponse = await request.delete(`/api/forms/${created.doc.id}`);
			expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
		});

		test('should return 404 when submitting to non-existent form', async ({ request }) => {
			const response = await request.post('/api/forms/nonexistent-form/submit', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Test' },
			});
			expect(response.status()).toBe(404);

			const body = (await response.json()) as { error: string };
			expect(body.error).toBe('Form not found');
		});

		test('should validate form data and return errors for invalid data', async ({ request }) => {
			const response = await request.post('/api/forms/contact-us/validate', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					// Missing all required fields
				},
			});

			expect(response.status()).toBe(422);

			const body = (await response.json()) as {
				valid: boolean;
				errors: Array<{ field: string; message: string }>;
			};
			expect(body.valid).toBe(false);

			// Should have errors for all 4 required fields: name, email, subject, message
			const errorFields = body.errors.map((e) => e.field);
			expect(errorFields).toContain('name');
			expect(errorFields).toContain('email');
			expect(errorFields).toContain('subject');
			expect(errorFields).toContain('message');
			expect(body.errors.length).toBe(4);
		});

		test('should validate form data and return success for valid data', async ({ request }) => {
			const response = await request.post('/api/forms/contact-us/validate', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					name: 'John Doe',
					email: 'john@example.com',
					subject: 'general',
					message: 'Hello, this is a test message.',
				},
			});

			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				valid: boolean;
				errors: Array<{ field: string; message: string }>;
			};
			expect(body.valid).toBe(true);
			expect(body.errors).toHaveLength(0);
		});

		test('should submit a form and store the submission', async ({ request }) => {
			const uniqueEmail = `e2e-submit-${uniqueSlug('s')}@example.com`;

			const submitResponse = await request.post('/api/forms/contact-us/submit', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					name: `E2E User ${uniqueEmail}`,
					email: uniqueEmail,
					subject: 'support',
					message: 'This is an E2E test submission.',
				},
			});

			expect(submitResponse.ok()).toBe(true);

			const submitBody = (await submitResponse.json()) as {
				success: boolean;
				message: string;
			};
			expect(submitBody.success).toBe(true);
			expect(submitBody.message).toBeTruthy();

			// Verify submission was stored
			const subsResponse = await request.get(
				'/api/form-submissions?where[formSlug][equals]=contact-us&limit=100',
			);
			expect(subsResponse.ok()).toBe(true);

			const subsBody = (await subsResponse.json()) as {
				docs: Array<{
					formSlug: string;
					data: Record<string, unknown>;
					metadata: Record<string, unknown>;
				}>;
			};

			const ourSub = subsBody.docs.find((s) => s.data?.['email'] === uniqueEmail);
			expect(ourSub, 'Submission should exist in form-submissions').toBeTruthy();
			expect(ourSub?.data?.['message']).toBe('This is an E2E test submission.');
			expect(ourSub?.formSlug).toBe('contact-us');
		});

		test('should increment submission count on the form after submission', async ({ request }) => {
			// Use a dedicated form to isolate from other tests' submissions
			const slug = uniqueSlug('count-test');

			// Create a fresh form with known initial count
			const createResponse = await request.post('/api/forms', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Count Test Form ${slug}`,
					slug,
					status: 'published',
					schema: {
						id: slug,
						fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
					},
					honeypot: false,
					submissionCount: 0,
				},
			});
			expect(createResponse.status()).toBe(201);

			const created = (await createResponse.json()) as { doc: { id: string } };

			// Get baseline count
			const beforeResponse = await request.get(`/api/forms/${created.doc.id}`);
			expect(beforeResponse.ok()).toBe(true);
			const beforeData = (await beforeResponse.json()) as {
				doc: { submissionCount: number };
			};
			const beforeCount = Number(beforeData.doc.submissionCount ?? 0);

			// Submit to this form
			const submitResponse = await request.post(`/api/forms/${slug}/submit`, {
				headers: { 'Content-Type': 'application/json' },
				data: { email: `count-${slug}@example.com` },
			});
			expect(submitResponse.ok(), 'Submit must succeed before checking count').toBe(true);

			// Get updated count
			const afterResponse = await request.get(`/api/forms/${created.doc.id}`);
			expect(afterResponse.ok()).toBe(true);
			const afterData = (await afterResponse.json()) as {
				doc: { submissionCount: number };
			};
			const afterCount = Number(afterData.doc.submissionCount ?? 0);

			expect(afterCount).toBe(beforeCount + 1);

			// Clean up
			const deleteResponse = await request.delete(`/api/forms/${created.doc.id}`);
			expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
		});

		test('should reject submissions when honeypot field is filled', async ({ request }) => {
			const botEmail = `bot-${uniqueSlug('b')}@example.com`;

			const response = await request.post('/api/forms/contact-us/submit', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					name: `Bot User ${botEmail}`,
					email: botEmail,
					subject: 'general',
					message: 'I am a bot.',
					_hp_field: 'got ya', // Honeypot filled → bot
				},
			});

			// Honeypot rejection is silent (returns 200 with success to fool bots)
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as { success: boolean };
			expect(body.success).toBe(true);

			// But no submission should be stored for this bot
			const subsResponse = await request.get(
				'/api/form-submissions?where[formSlug][equals]=contact-us&limit=100',
			);
			expect(subsResponse.ok()).toBe(true);

			const subsBody = (await subsResponse.json()) as {
				docs: Array<{ data: Record<string, unknown> }>;
			};

			const botSub = subsBody.docs.find((s) => s.data?.['email'] === botEmail);
			expect(botSub, 'Bot submission should NOT be stored').toBeFalsy();
		});

		test('should store submission metadata (IP, user-agent)', async ({ request }) => {
			const email = `meta-test-${uniqueSlug('m')}@example.com`;

			const submitResponse = await request.post('/api/forms/contact-us/submit', {
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'E2E-Test-Agent/1.0',
				},
				data: {
					name: 'Metadata Test',
					email,
					subject: 'feedback',
					message: 'Testing metadata storage.',
				},
			});
			expect(submitResponse.ok(), 'Submit must succeed').toBe(true);

			// Fetch submission
			const subsResponse = await request.get(
				'/api/form-submissions?where[formSlug][equals]=contact-us&limit=100',
			);
			expect(subsResponse.ok()).toBe(true);

			const subsBody = (await subsResponse.json()) as {
				docs: Array<{
					data: Record<string, unknown>;
					metadata: { ip: string; userAgent: string; submittedAt: string };
				}>;
			};

			const sub = subsBody.docs.find((s) => s.data?.['email'] === email);
			expect(sub, 'Submission must exist').toBeTruthy();
			expect(sub?.metadata).toBeDefined();
			expect(sub?.metadata?.userAgent).toBeTruthy();
			expect(sub?.metadata?.submittedAt).toBeTruthy();
		});
	});

	// ─── Conditional Field Validation ─────────────────────────────────

	test.describe('Conditional field validation', { tag: ['@api'] }, () => {
		let conditionalFormId: string;
		const conditionalSlug = `cond-${Date.now()}`;

		test.beforeAll(async ({ request }) => {
			const signInResponse = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

			// Create a form with conditional required fields
			const createResponse = await request.post('/api/forms', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Conditional Form ${conditionalSlug}`,
					slug: conditionalSlug,
					status: 'published',
					schema: {
						id: conditionalSlug,
						fields: [
							{
								name: 'contactMethod',
								type: 'select',
								label: 'Contact Method',
								required: true,
								options: [
									{ label: 'Email', value: 'email' },
									{ label: 'Phone', value: 'phone' },
								],
							},
							{
								name: 'phone',
								type: 'text',
								label: 'Phone Number',
								required: true,
								conditions: [{ field: 'contactMethod', operator: 'equals', value: 'phone' }],
							},
							{
								name: 'emailAddr',
								type: 'email',
								label: 'Email Address',
								required: true,
								conditions: [{ field: 'contactMethod', operator: 'equals', value: 'email' }],
							},
						],
					},
					honeypot: false,
					submissionCount: 0,
				},
			});
			expect(createResponse.status()).toBe(201);
			const body = (await createResponse.json()) as { doc: { id: string } };
			conditionalFormId = body.doc.id;
		});

		test.afterAll(async ({ request }) => {
			if (conditionalFormId) {
				await request.delete(`/api/forms/${conditionalFormId}`);
			}
		});

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

		test('should accept submission when hidden conditional required field is missing', async ({
			request,
		}) => {
			// User selects "email" → "phone" field is hidden via condition → not required
			const response = await request.post(`/api/forms/${conditionalSlug}/submit`, {
				headers: { 'Content-Type': 'application/json' },
				data: {
					contactMethod: 'email',
					emailAddr: 'user@example.com',
					// phone is NOT provided — but it's hidden because contactMethod != 'phone'
				},
			});

			expect(response.ok(), 'Should accept valid data when hidden field is missing').toBe(true);
			const body = (await response.json()) as { success: boolean };
			expect(body.success).toBe(true);
		});

		test('should reject submission when visible conditional required field is missing', async ({
			request,
		}) => {
			// User selects "phone" → "phone" field is visible via condition → required
			const response = await request.post(`/api/forms/${conditionalSlug}/submit`, {
				headers: { 'Content-Type': 'application/json' },
				data: {
					contactMethod: 'phone',
					// phone is NOT provided — but it's VISIBLE because contactMethod == 'phone'
				},
			});

			expect(response.status()).toBe(422);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ field: string }>;
			};
			expect(body.success).toBe(false);
			const errorFields = body.errors.map((e) => e.field);
			expect(errorFields).toContain('phone');
		});

		test('should validate correctly when hidden conditional field is missing', async ({
			request,
		}) => {
			// /validate endpoint should also respect conditions
			const response = await request.post(`/api/forms/${conditionalSlug}/validate`, {
				headers: { 'Content-Type': 'application/json' },
				data: {
					contactMethod: 'email',
					emailAddr: 'user@example.com',
					// phone hidden → not validated
				},
			});

			expect(response.ok()).toBe(true);
			const body = (await response.json()) as { valid: boolean; errors: Array<unknown> };
			expect(body.valid).toBe(true);
			expect(body.errors).toHaveLength(0);
		});
	});

	// ─── Rate Limiting ────────────────────────────────────────────────

	test.describe('Rate limiting', { tag: ['@api'] }, () => {
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

		test('should rate-limit /validate endpoint after exceeding limit', async ({ request }) => {
			// The app is configured with rateLimitPerMinute: 10.
			// The rate limiter is shared per IP across /submit and /validate,
			// and previous tests may have used some of the budget. Send enough
			// requests to guarantee we exceed the limit regardless.
			const promises = Array.from({ length: 15 }, () =>
				request.post('/api/forms/contact-us/validate', {
					headers: { 'Content-Type': 'application/json' },
					data: { name: 'Test', email: 'test@example.com', subject: 'general', message: 'Hello' },
				}),
			);

			const responses = await Promise.all(promises);
			const statuses = responses.map((r) => r.status());

			// At least one should be 429 (rate limited)
			expect(
				statuses.includes(429),
				`Expected at least one 429 response but got: ${statuses.join(', ')}`,
			).toBe(true);
		});
	});

	// ─── Unauthenticated Access (separate describe, no beforeEach sign-in) ─
	test.describe('Unauthenticated access', { tag: ['@api'] }, () => {
		test('should deny unauthenticated access to form-submissions list', async ({ request }) => {
			// This runs in a fresh request context with NO sign-in beforeEach
			const response = await request.get('/api/form-submissions');
			expect(response.status()).toBe(403);
		});
	});

	// ─── Form Rendering Tests (Headed Mode - Block on Page) ────────────

	test.describe('Form rendering on page', { tag: ['@ui'] }, () => {
		test('should render a form block with all expected fields on the contact page', async ({
			authenticatedPage,
		}) => {
			// Navigate to the seeded contact form page
			await authenticatedPage.goto('/contact');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// The form block should be rendered
			const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
			await expect(formBlock).toBeVisible({ timeout: 15000 });

			// Form builder component should render form fields
			const formElement = formBlock.locator('form');
			await expect(formElement).toBeVisible();

			// Verify all 4 fields from the seeded schema actually rendered
			await expect(formBlock.locator('input[name="name"]')).toBeVisible();
			await expect(formBlock.locator('input[name="email"]')).toBeVisible();
			await expect(formBlock.locator('select[name="subject"]')).toBeVisible();
			await expect(formBlock.locator('textarea[name="message"]')).toBeVisible();

			// Verify the submit button shows the correct label from schema settings
			await expect(formBlock.getByRole('button', { name: /send message/i })).toBeVisible();
		});

		test('should show validation errors for all required fields when submitting empty', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/contact');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
			await expect(formBlock).toBeVisible({ timeout: 15000 });

			// Click the submit button without filling anything
			const submitButton = formBlock.getByRole('button', { name: /send message/i });
			await expect(submitButton).toBeVisible();
			await submitButton.click();

			// Validation errors should appear for required fields
			await expect(formBlock.locator('[data-testid*="error"], [role="alert"]').first()).toBeVisible(
				{ timeout: 5000 },
			);

			// Count error elements (excluding the form-level summary alert)
			const fieldErrors = formBlock.locator('[data-testid*="error"]');
			const errorCount = await fieldErrors.count();
			// The seeded form has 4 required fields: name, email, subject, message
			expect(errorCount, 'Should show errors for all 4 required fields').toBeGreaterThanOrEqual(4);
		});

		test('should submit the form successfully with valid data', async ({ authenticatedPage }) => {
			const uniqueEmail = `render-${uniqueSlug('r')}@example.com`;

			await authenticatedPage.goto('/contact');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
			await expect(formBlock).toBeVisible({ timeout: 15000 });

			// Fill out the form
			await formBlock.locator('input[name="name"]').fill(`E2E Render User`);
			await formBlock.locator('input[name="email"]').fill(uniqueEmail);

			// Select subject — must be visible since it's a required field
			const selectElement = formBlock.locator('select[name="subject"]');
			await expect(selectElement, 'Subject field must be visible').toBeVisible();
			await selectElement.selectOption('general');

			// Fill message
			await formBlock.locator('textarea[name="message"]').fill('Testing form rendering.');

			// Submit
			const submitButton = formBlock.getByRole('button', { name: /send message/i });
			await submitButton.click();

			// Wait for success message
			await expect(authenticatedPage.getByText(/thank you/i)).toBeVisible({ timeout: 10000 });

			// Verify the submission was actually stored in the database
			const subsResponse = await authenticatedPage.request.get(
				'/api/form-submissions?where[formSlug][equals]=contact-us&limit=100',
			);
			expect(subsResponse.ok()).toBe(true);

			const subsBody = (await subsResponse.json()) as {
				docs: Array<{ data: Record<string, unknown> }>;
			};
			const ourSub = subsBody.docs.find((s) => s.data?.['email'] === uniqueEmail);
			expect(ourSub, 'UI-submitted form data should be stored in database').toBeTruthy();
		});
	});

	// ─── Submission Viewer Tests (Admin) ───────────────────────────────

	test.describe('Submission viewer', { tag: ['@admin'] }, () => {
		test('should show submissions in the admin list after form submission', async ({
			authenticatedPage,
		}) => {
			// First submit a form via API so we know there's at least one submission
			const uniqueEmail = `viewer-${uniqueSlug('v')}@example.com`;

			const submitResponse = await authenticatedPage.request.post('/api/forms/contact-us/submit', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					name: `Viewer Test`,
					email: uniqueEmail,
					subject: 'general',
					message: 'Testing admin viewer.',
				},
			});
			expect(submitResponse.ok(), 'Submit must succeed').toBe(true);

			// Navigate to submissions list
			await authenticatedPage.goto('/admin/collections/form-submissions');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 10000 });

			// Should show at least one submission with the contact-us slug
			await expect(
				authenticatedPage
					.locator('mcms-table-cell')
					.filter({ hasText: /contact-us/i })
					.first(),
			).toBeVisible();
		});

		test('should display submission data in the detail view', async ({ authenticatedPage }) => {
			// Create a submission with unique data we can verify
			const uniqueEmail = `detail-${uniqueSlug('d')}@example.com`;
			const uniqueMessage = `Detail view test ${Date.now()}`;

			await authenticatedPage.request.post('/api/forms/contact-us/submit', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					name: `Detail Test User`,
					email: uniqueEmail,
					subject: 'support',
					message: uniqueMessage,
				},
			});

			// Fetch the submission via API to get its ID
			const subsResponse = await authenticatedPage.request.get(
				'/api/form-submissions?where[formSlug][equals]=contact-us&limit=100',
			);
			expect(subsResponse.ok()).toBe(true);

			const subsBody = (await subsResponse.json()) as {
				docs: Array<{
					id: string;
					formSlug: string;
					data: Record<string, unknown>;
				}>;
			};

			const ourSub = subsBody.docs.find((s) => s.data?.['email'] === uniqueEmail);
			expect(ourSub, 'Test submission must exist').toBeTruthy();

			// Navigate to the detail view
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified above
			await authenticatedPage.goto(`/admin/collections/form-submissions/${ourSub!.id}`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Verify key labels are visible
			await expect(authenticatedPage.getByText('Form Slug')).toBeVisible({ timeout: 10000 });
			await expect(authenticatedPage.getByText('contact-us')).toBeVisible();
			await expect(authenticatedPage.getByText('Form Title')).toBeVisible();

			// Verify the UNIQUE submission data appears (not just generic labels)
			await expect(authenticatedPage.getByText(uniqueEmail)).toBeVisible();
		});
	});

	// ─── Inline Block Editing (Admin Visual Editor) ──────────────────────

	test.describe('Inline block editing', { tag: ['@admin', '@blocks'] }, () => {
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

		/** Helper: get the seeded "Contact Us" form ID */
		async function getContactFormId(
			request: import('@playwright/test').APIRequestContext,
		): Promise<string> {
			const res = await request.get('/api/forms?where[slug][equals]=contact-us&limit=1');
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as { docs: Array<{ id: string }> };
			expect(body.docs.length).toBeGreaterThan(0);
			return body.docs[0].id;
		}

		test('can add a form block via inserter and see form relationship dropdown', async ({
			authenticatedPage,
			request,
		}) => {
			// Create a blank test page
			const slug = uniqueSlug('form-inline');
			const createResponse = await request.post('/api/pages', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: `Form Inline Test ${slug}`, slug, content: [] },
			});
			expect(createResponse.status()).toBe(201);
			const { doc: page } = (await createResponse.json()) as { doc: { id: string } };

			try {
				await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
				await expect(visualEditor).toBeVisible({ timeout: 10000 });

				// Add a form block via inserter
				const inserter = authenticatedPage.locator('[data-testid="block-inserter"]');
				await inserter.first().locator('button').click();

				const formOption = authenticatedPage.getByRole('option', { name: /Form/i });
				await expect(formOption).toBeVisible({ timeout: 5000 });
				await formOption.click();

				// Form block should appear
				const formBlock = authenticatedPage.locator('[data-block-type="form"]');
				await expect(formBlock).toBeVisible({ timeout: 5000 });

				// Should show the Form relationship dropdown (select element)
				const formSelect = formBlock.locator('select').first();
				await expect(formSelect).toBeVisible({ timeout: 5000 });

				// The dropdown should have the seeded "Contact Us" form as an option
				const contactOption = formSelect.locator('option', { hasText: /Contact Us/i });
				await expect(contactOption).toBeAttached();
			} finally {
				const deleteResponse = await request.delete(`/api/pages/${page.id}`);
				expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
			}
		});

		test('can select a form from dropdown, save, and verify via API', async ({
			authenticatedPage,
			request,
		}) => {
			const contactFormId = await getContactFormId(request);

			// Create a page with no blocks, then add a form block in the UI
			const slug = uniqueSlug('form-edit');
			const createResponse = await request.post('/api/pages', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Form Edit Test ${slug}`,
					slug,
					content: [],
				},
			});
			expect(createResponse.status()).toBe(201);
			const { doc: page } = (await createResponse.json()) as { doc: { id: string } };

			try {
				await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
				await expect(visualEditor).toBeVisible({ timeout: 10000 });

				// Add a form block via the inserter
				const inserter = authenticatedPage.locator('[data-testid="block-inserter"]');
				await inserter.first().locator('button').click();
				const formOption = authenticatedPage.getByRole('option', { name: /Form/i });
				await expect(formOption).toBeVisible({ timeout: 5000 });
				await formOption.click();

				const formBlock = authenticatedPage.locator('[data-block-type="form"]');
				await expect(formBlock).toBeVisible({ timeout: 5000 });

				// Select "Contact Us" from the relationship dropdown
				const formSelect = formBlock.locator('select').first();
				await expect(formSelect).toBeVisible({ timeout: 5000 });
				await formSelect.selectOption({ label: 'Contact Us' });

				// Save changes
				const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
				await saveButton.click();
				await expect(authenticatedPage.locator('.toast-title')).toBeVisible({ timeout: 10000 });

				// Verify via API — block should store the form ID
				const getResponse = await request.get(`/api/pages/${page.id}`);
				expect(getResponse.ok()).toBe(true);
				const getBody = (await getResponse.json()) as {
					doc: { content: Array<{ blockType: string; form?: string }> };
				};
				expect(getBody.doc.content).toHaveLength(1);
				expect(getBody.doc.content[0].blockType).toBe('form');
				expect(getBody.doc.content[0].form).toBe(contactFormId);
			} finally {
				const deleteResponse = await request.delete(`/api/pages/${page.id}`);
				expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
			}
		});

		test('form block stores relationship ID, not schema JSON', async ({
			authenticatedPage,
			request,
		}) => {
			const contactFormId = await getContactFormId(request);

			// Create a page with a form block referencing the seeded form
			const slug = uniqueSlug('form-noschema');
			const createResponse = await request.post('/api/pages', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `No Schema Test ${slug}`,
					slug,
					content: [{ blockType: 'form', form: contactFormId, showHoneypot: true }],
				},
			});
			expect(createResponse.status()).toBe(201);
			const { doc: page } = (await createResponse.json()) as { doc: { id: string } };

			try {
				// Open in admin, save, then verify the block data via API
				await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
				await expect(visualEditor).toBeVisible({ timeout: 10000 });

				// Save (no changes needed — just confirm the save format)
				const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
				await saveButton.click();
				await expect(authenticatedPage.locator('.toast-title')).toBeVisible({ timeout: 10000 });

				// Verify via API: block stores form ID, not schema JSON
				const getResponse = await request.get(`/api/pages/${page.id}`);
				expect(getResponse.ok()).toBe(true);
				const getBody = (await getResponse.json()) as {
					doc: {
						content: Array<{
							blockType: string;
							form?: string;
							schema?: unknown;
						}>;
					};
				};
				expect(getBody.doc.content).toHaveLength(1);
				expect(getBody.doc.content[0].form).toBe(contactFormId);
				// schema should NOT be stored in the block — it's fetched at render time
				expect(getBody.doc.content[0].schema).toBeUndefined();
			} finally {
				const deleteResponse = await request.delete(`/api/pages/${page.id}`);
				expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
			}
		});

		test('form block renders correctly on public page via relationship', async ({
			authenticatedPage,
			request,
		}) => {
			const contactFormId = await getContactFormId(request);

			// Create a page with a form block pointing to the seeded form via ID
			const slug = uniqueSlug('form-render-edit');
			const createResponse = await request.post('/api/pages', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Form Render Edit ${slug}`,
					slug,
					content: [{ blockType: 'form', form: contactFormId, showHoneypot: true }],
				},
			});
			expect(createResponse.status()).toBe(201);
			const { doc: page } = (await createResponse.json()) as { doc: { id: string } };

			try {
				// Visit the public page — form should render via API fetch using the ID
				await authenticatedPage.goto(`/${slug}`);
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
				await expect(formBlock).toBeVisible({ timeout: 15000 });

				// Form should have rendered with fields from the contact-us form
				const formElement = formBlock.locator('form');
				await expect(formElement).toBeVisible();

				// Should have all 4 fields from the seeded schema
				await expect(formBlock.locator('input[name="name"]')).toBeVisible();
				await expect(formBlock.locator('input[name="email"]')).toBeVisible();
				await expect(formBlock.locator('select[name="subject"]')).toBeVisible();
				await expect(formBlock.locator('textarea[name="message"]')).toBeVisible();
			} finally {
				const deleteResponse = await request.delete(`/api/pages/${page.id}`);
				expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);
			}
		});
	});

	// ─── Live Page Inline Editing ──────────────────────────────────────

	test.describe('Live page inline editing', { tag: ['@ui', '@blocks'] }, () => {
		test('should show Edit Block button and open inline edit dialog with relationship dropdown', async ({
			authenticatedPage,
		}) => {
			// Navigate to the seeded contact form page (as authenticated admin)
			await authenticatedPage.goto('/contact');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Wait for the form block to render
			const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
			await expect(formBlock).toBeVisible({ timeout: 15000 });

			// Admin mode should show edit overlays — find the Edit Block button on the form block
			const editWrapper = authenticatedPage.locator(
				'[data-testid="block-edit-wrapper"][data-block-type="form"]',
			);
			await expect(editWrapper).toBeVisible({ timeout: 10000 });

			// Hover to reveal the edit button
			await editWrapper.hover();
			const editButton = editWrapper.locator('[data-testid="block-edit-button"]');
			await expect(editButton).toBeVisible({ timeout: 5000 });
			await editButton.click();

			// The InlineBlockEditDialog should open with the relationship dropdown
			const dialog = authenticatedPage.locator('app-inline-block-edit-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });

			// Dialog title should say "Edit Form"
			await expect(dialog.getByText('Edit Form')).toBeVisible();

			// Should have a select dropdown for the form relationship
			const formSelect = dialog.locator('mcms-select select, select').first();
			await expect(formSelect).toBeVisible({ timeout: 5000 });

			// The dropdown should contain the "Contact Us" option
			const contactOption = formSelect.locator('option', { hasText: /Contact Us/i });
			await expect(contactOption).toBeAttached();

			// Should also have the Enable Honeypot checkbox
			const honeypotCheckbox = dialog.locator('mcms-checkbox').first();
			await expect(honeypotCheckbox).toBeVisible();

			// Close dialog without saving
			await dialog.getByRole('button', { name: 'Cancel' }).click();
			await expect(dialog).not.toBeVisible();
		});

		test('should save changes via inline edit dialog and re-render form', async ({
			authenticatedPage,
			request,
		}) => {
			// Sign in for API access
			const signInResponse = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

			// Create a second published form so we can switch between them
			const slug2 = uniqueSlug('inline-edit-form');
			const createFormRes = await request.post('/api/forms', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Inline Edit Test Form`,
					slug: slug2,
					status: 'published',
					schema: {
						id: slug2,
						fields: [{ name: 'feedback', type: 'textarea', label: 'Feedback', required: true }],
					},
					honeypot: false,
					submissionCount: 0,
				},
			});
			expect(createFormRes.status()).toBe(201);
			const { doc: form2 } = (await createFormRes.json()) as { doc: { id: string } };

			// Create a test page with the contact-us form
			const contactFormRes = await request.get('/api/forms?where[slug][equals]=contact-us&limit=1');
			const contactFormBody = (await contactFormRes.json()) as { docs: Array<{ id: string }> };
			const contactFormId = contactFormBody.docs[0].id;

			const pageSlug = uniqueSlug('inline-edit-page');
			const createPageRes = await request.post('/api/pages', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					title: `Inline Edit Page ${pageSlug}`,
					slug: pageSlug,
					content: [{ blockType: 'form', form: contactFormId, showHoneypot: false }],
				},
			});
			expect(createPageRes.status()).toBe(201);
			const { doc: testPage } = (await createPageRes.json()) as { doc: { id: string } };

			try {
				// Visit the test page
				await authenticatedPage.goto(`/${pageSlug}`);
				await authenticatedPage.waitForLoadState('domcontentloaded');

				const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
				await expect(formBlock).toBeVisible({ timeout: 15000 });

				// Open inline edit dialog
				const editWrapper = authenticatedPage.locator(
					'[data-testid="block-edit-wrapper"][data-block-type="form"]',
				);
				await editWrapper.hover();
				const editButton = editWrapper.locator('[data-testid="block-edit-button"]');
				await expect(editButton).toBeVisible({ timeout: 5000 });
				await editButton.click();

				const dialog = authenticatedPage.locator('app-inline-block-edit-dialog');
				await expect(dialog).toBeVisible({ timeout: 5000 });

				// Switch the form to the new test form
				const formSelect = dialog.locator('mcms-select select, select').first();
				await expect(formSelect).toBeVisible({ timeout: 5000 });
				await formSelect.selectOption({ label: 'Inline Edit Test Form' });

				// Save
				await dialog.getByRole('button', { name: 'Save' }).click();
				await expect(dialog).not.toBeVisible({ timeout: 10000 });

				// Verify the page now references the new form via API
				const pageRes = await request.get(`/api/pages/${testPage.id}`);
				expect(pageRes.ok()).toBe(true);
				const pageBody = (await pageRes.json()) as {
					doc: { content: Array<{ blockType: string; form?: string }> };
				};
				expect(pageBody.doc.content[0].form).toBe(form2.id);
			} finally {
				await request.delete(`/api/pages/${testPage.id}`);
				await request.delete(`/api/forms/${form2.id}`);
			}
		});
	});

	// ─── Form Schema Editor (Admin Visual Builder) ──────────────────────

	test.describe('Form schema editor', { tag: ['@admin'] }, () => {
		test('should show visual schema editor instead of raw JSON on form edit page', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');
			await expect(editor).toBeVisible();

			// Should have 4 field cards (name, email, subject, message)
			const fieldCards = editor.locator('[data-testid="field-card"]');
			await expect(fieldCards).toHaveCount(4);

			// Each card shows type badge, label, and drag handle
			for (const fieldName of ['name', 'email', 'subject', 'message']) {
				const card = editor.locator(`[data-testid="field-card"][data-field-name="${fieldName}"]`);
				await expect(card).toBeVisible();
			}

			// "Add Field" button should be visible
			await expect(editor.locator('[data-testid="add-field-button"]').first()).toBeVisible();
		});

		test('should show live preview of the form alongside the editor', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			// Preview panel should be visible
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			await expect(previewPanel).toBeVisible();

			// Preview should render an actual <form> element
			const formElement = previewPanel.locator('form');
			await expect(formElement).toBeVisible({ timeout: 10000 });

			// Preview should have inputs matching the seeded schema fields
			await expect(previewPanel.locator('input[name="name"]')).toBeVisible();
			await expect(previewPanel.locator('input[name="email"]')).toBeVisible();
			await expect(previewPanel.locator('select[name="subject"]')).toBeVisible();
			await expect(previewPanel.locator('textarea[name="message"]')).toBeVisible();

			// Submit button should show "Send Message" from seeded settings
			await expect(previewPanel.getByRole('button', { name: /send message/i })).toBeVisible();
		});

		test('should add a new field and see it in preview', async ({ authenticatedPage }) => {
			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');

			// Verify initial field count
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(4);

			// Click "Add Field" → select "text" type
			const addButton = editor.locator('[data-testid="add-field-button"]').first();
			await addButton.click();

			const textOption = authenticatedPage.locator('button[mcms-dropdown-item]', {
				hasText: 'Text',
			});
			await expect(textOption).toBeVisible({ timeout: 5000 });
			await textOption.click();

			// Dialog should open for the new field
			const dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });

			// Set name and label
			const nameInput = dialog.locator('#fieldName input, #fieldName');
			await nameInput.fill('phone');

			const labelInput = dialog.locator('#fieldLabel input, #fieldLabel');
			await labelInput.fill('Phone Number');

			// Save the field
			const saveButton = dialog.getByRole('button', { name: /add field/i });
			await saveButton.click();

			// Dialog should close
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Field count should increase to 5
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(5);

			// New card should show "Phone Number" label
			const newCard = editor.locator('[data-testid="field-card"][data-field-name="phone"]');
			await expect(newCard).toBeVisible();

			// Preview should now show a phone input field
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			await expect(previewPanel.locator('input[name="phone"]')).toBeVisible({ timeout: 5000 });
		});

		test('should edit an existing field via the field editor dialog', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');

			// Click on the "name" field card to open editor dialog
			const nameCard = editor.locator('[data-testid="field-card"][data-field-name="name"]');
			await nameCard.click();

			// Dialog should open
			const dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });

			// Verify current label value matches seeded data
			const labelInput = dialog.locator('#fieldLabel input, #fieldLabel');
			await expect(labelInput).toHaveValue('Full Name');

			// Change label
			await labelInput.fill('Your Full Name');

			// Save
			const saveButton = dialog.getByRole('button', { name: /save changes/i });
			await saveButton.click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Card should now show updated label
			const updatedLabel = nameCard.locator('[data-testid="field-label"]');
			await expect(updatedLabel).toContainText('Your Full Name');

			// Preview should update too
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			await expect(previewPanel.getByText('Your Full Name')).toBeVisible({ timeout: 5000 });
		});

		test('should remove a field and see it disappear from preview', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');

			// Verify initial count
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(4);

			// Click delete button on the last field card (message)
			const messageCard = editor.locator('[data-testid="field-card"][data-field-name="message"]');
			await expect(messageCard).toBeVisible();
			const deleteButton = messageCard.locator('[data-testid="remove-field-button"]');
			await deleteButton.click();

			// Field count should drop to 3
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(3);

			// Preview should no longer show the textarea for message
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			await expect(previewPanel.locator('textarea[name="message"]')).not.toBeVisible({
				timeout: 5000,
			});
		});

		test('should persist schema changes when saving the form', async ({
			authenticatedPage,
			request,
		}) => {
			// Sign in for API access
			const signInResponse = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(4);

			// Add a new "checkbox" field
			const addButton = editor.locator('[data-testid="add-field-button"]').first();
			await addButton.click();

			const checkboxOption = authenticatedPage.locator('button[mcms-dropdown-item]', {
				hasText: 'Checkbox',
			});
			await expect(checkboxOption).toBeVisible({ timeout: 5000 });
			await checkboxOption.click();

			// Dialog opens for the new field
			const dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });

			// Set name and label
			const nameInput = dialog.locator('#fieldName input, #fieldName');
			await nameInput.fill('newsletter');

			const labelInput = dialog.locator('#fieldLabel input, #fieldLabel');
			await labelInput.fill('Subscribe to newsletter');

			// Save dialog
			const addFieldBtn = dialog.getByRole('button', { name: /add field/i });
			await addFieldBtn.click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Should have 5 field cards now
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(5);

			// Save the entity form (click Update/Save button)
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
			await saveButton.click();

			// Wait for success toast
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({ timeout: 10000 });

			// Verify via API that the schema persisted
			const formsRes = await request.get('/api/forms?where[slug][equals]=contact-us&limit=1');
			expect(formsRes.ok()).toBe(true);
			const formsBody = (await formsRes.json()) as {
				docs: Array<{
					id: string;
					schema: { fields: Array<{ name: string; type: string }> };
				}>;
			};
			expect(formsBody.docs.length).toBe(1);

			const fields = formsBody.docs[0].schema.fields;
			const newsletterField = fields.find((f) => f.name === 'newsletter');
			expect(newsletterField, 'Newsletter field should be persisted in schema').toBeTruthy();
			expect(newsletterField?.type).toBe('checkbox');

			// Reload and verify field list still shows 5 fields
			await authenticatedPage.reload();
			await expect(authenticatedPage.locator('[data-testid="form-schema-editor"]')).toBeVisible({
				timeout: 15000,
			});
			await expect(
				authenticatedPage.locator('[data-testid="form-schema-editor"] [data-testid="field-card"]'),
			).toHaveCount(5);

			// Clean up: remove the added field to restore original state for other tests
			const formId = formsBody.docs[0].id;
			const originalSchema = formsBody.docs[0].schema;
			originalSchema.fields = originalSchema.fields.filter((f) => f.name !== 'newsletter');
			await request.patch(`/api/forms/${formId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { schema: originalSchema },
			});
		});

		test('should show options editor for select/radio fields', async ({ authenticatedPage }) => {
			await navigateToContactFormEdit(authenticatedPage);

			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');

			// Click on the "subject" field card (type: select)
			const subjectCard = editor.locator('[data-testid="field-card"][data-field-name="subject"]');
			await subjectCard.click();

			// Dialog should open
			const dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });

			// Should show options editor section
			const optionRows = dialog.locator('[data-testid="option-row"]');
			await expect(optionRows).toHaveCount(3); // General, Support, Feedback

			// Add a new option
			const addOptionBtn = dialog.getByRole('button', { name: /add option/i });
			await addOptionBtn.click();
			await expect(optionRows).toHaveCount(4);

			// Fill the new option
			const newOptionRow = optionRows.nth(3);
			const labelInputs = newOptionRow.locator('mcms-input input, input');
			await labelInputs.first().fill('Sales');
			await labelInputs.nth(1).fill('sales');

			// Save
			const saveButton = dialog.getByRole('button', { name: /save changes/i });
			await saveButton.click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Preview select should include "Sales" option
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			const selectElement = previewPanel.locator('select[name="subject"]');
			await expect(selectElement).toBeVisible({ timeout: 5000 });
			const salesOption = selectElement.locator('option', { hasText: /Sales/i });
			await expect(salesOption).toBeAttached();
		});

		test('should create a new form from scratch with the visual editor', async ({
			authenticatedPage,
			request,
		}) => {
			// Sign in for API access
			const signInResponse = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);

			const slug = uniqueSlug('builder');

			// Navigate to create form page
			await authenticatedPage.goto('/admin/collections/forms/create');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Fill in basic form fields (title, slug, status)
			// Wait for the entity form to load
			await expect(
				authenticatedPage.locator('mcms-entity-form, [data-testid="entity-form"]'),
			).toBeVisible({ timeout: 10000 });

			// Title
			const titleInput = authenticatedPage.locator('#title input, input[name="title"]').first();
			await expect(titleInput).toBeVisible({ timeout: 5000 });
			await titleInput.fill('E2E Builder Test');

			// Slug
			const slugInput = authenticatedPage.locator('#slug input, input[name="slug"]').first();
			await expect(slugInput).toBeVisible({ timeout: 5000 });
			await slugInput.fill(slug);

			// Status - set to published
			const statusSelect = authenticatedPage
				.locator('#status select, select[name="status"]')
				.first();
			await expect(statusSelect).toBeVisible({ timeout: 5000 });
			await statusSelect.selectOption('published');

			// The schema editor should show empty state
			const editor = authenticatedPage.locator('[data-testid="form-schema-editor"]');
			await expect(editor).toBeVisible({ timeout: 15000 });

			// Add 3 fields: text "Full Name" (required), email "Email" (required), textarea "Message"
			// Field 1: Text - Full Name
			const addButton = editor.locator('[data-testid="add-field-button"]').first();
			await addButton.click();
			const textOption = authenticatedPage.locator('button[mcms-dropdown-item]', {
				hasText: 'Text',
			});
			await expect(textOption).toBeVisible({ timeout: 5000 });
			await textOption.click();

			let dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });
			await dialog.locator('#fieldName input, #fieldName').fill('fullName');
			await dialog.locator('#fieldLabel input, #fieldLabel').fill('Full Name');
			// Check required
			const requiredCheckbox = dialog.locator('#fieldRequired');
			await requiredCheckbox.click();
			await dialog.getByRole('button', { name: /add field/i }).click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Field 2: Email
			await addButton.click();
			const emailOption = authenticatedPage.locator('button[mcms-dropdown-item]', {
				hasText: 'Email',
			});
			await expect(emailOption).toBeVisible({ timeout: 5000 });
			await emailOption.click();

			dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });
			await dialog.locator('#fieldName input, #fieldName').fill('email');
			await dialog.locator('#fieldLabel input, #fieldLabel').fill('Email');
			await dialog.locator('#fieldRequired').click();
			await dialog.getByRole('button', { name: /add field/i }).click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Field 3: Textarea - Message
			await addButton.click();
			const textareaOption = authenticatedPage.locator('button[mcms-dropdown-item]', {
				hasText: 'Text Area',
			});
			await expect(textareaOption).toBeVisible({ timeout: 5000 });
			await textareaOption.click();

			dialog = authenticatedPage.locator('mcms-form-field-editor-dialog');
			await expect(dialog).toBeVisible({ timeout: 5000 });
			await dialog.locator('#fieldName input, #fieldName').fill('message');
			await dialog.locator('#fieldLabel input, #fieldLabel').fill('Message');
			await dialog.getByRole('button', { name: /add field/i }).click();
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Verify 3 field cards
			await expect(editor.locator('[data-testid="field-card"]')).toHaveCount(3);

			// Preview should show all 3 fields
			const previewPanel = authenticatedPage.locator('[data-testid="form-preview-panel"]');
			await expect(previewPanel.locator('form')).toBeVisible({ timeout: 10000 });

			// Save the form
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Create/i });
			await saveButton.click();
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({ timeout: 10000 });

			// Verify via API
			const formsRes = await request.get(`/api/forms?where[slug][equals]=${slug}&limit=1`);
			expect(formsRes.ok()).toBe(true);
			const formsBody = (await formsRes.json()) as {
				docs: Array<{
					id: string;
					slug: string;
					schema: { fields: Array<{ name: string; type: string }> };
				}>;
			};
			expect(formsBody.docs.length).toBe(1);
			expect(formsBody.docs[0].slug).toBe(slug);

			const fields = formsBody.docs[0].schema.fields;
			expect(fields.length).toBe(3);
			expect(fields.map((f) => f.name)).toEqual(['fullName', 'email', 'message']);

			// Clean up
			const deleteRes = await request.delete(`/api/forms/${formsBody.docs[0].id}`);
			expect(deleteRes.ok(), 'Cleanup delete must succeed').toBe(true);
		});

		test('should pass accessibility checks on the form schema editor', async ({
			authenticatedPage,
		}) => {
			await navigateToContactFormEdit(authenticatedPage);

			// Wait for editor to fully load
			await expect(authenticatedPage.locator('[data-testid="form-schema-editor"]')).toBeVisible({
				timeout: 15000,
			});

			// Run axe audit
			const results = await checkA11y(authenticatedPage);

			expect(
				results.violations,
				`Form schema editor has ${results.violations.length} axe violation(s):\n` +
					results.violations
						.map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`)
						.join('\n'),
			).toEqual([]);
		});
	});

	// ─── Accessibility ─────────────────────────────────────────────────

	test.describe('Accessibility', { tag: ['@a11y'] }, () => {
		test('should pass axe accessibility checks on the contact form page', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/contact');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Wait for form to render
			const formBlock = authenticatedPage.locator('[data-testid="block-form"]');
			await expect(formBlock).toBeVisible({ timeout: 15000 });

			const results = await checkA11y(authenticatedPage);

			// Unconditionally assert zero violations (project convention)
			expect(
				results.violations,
				`Contact form page has ${results.violations.length} axe violation(s):\n` +
					results.violations
						.map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`)
						.join('\n'),
			).toEqual([]);
		});
	});
});

import { test, expect, TEST_CREDENTIALS, TEST_EDITOR_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

// All tests run serially — queue/cron state is shared
test.describe.configure({ mode: 'serial' });

test.describe('Queue & Cron Plugins', { tag: ['@admin', '@queue', '@cron'] }, () => {
	// ============================================
	// Admin Dashboard — collection visibility
	// ============================================
	test.describe('Admin Dashboard — System group visibility', () => {
		test('should show System group heading on admin dashboard', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			await expect(
				authenticatedPage.getByRole('heading', { name: 'System', level: 2 }),
			).toBeVisible({ timeout: 15000 });
		});

		test('should show Jobs and Cron Schedules cards in System group', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const systemSection = authenticatedPage.getByRole('region', { name: 'System' });
			await expect(systemSection).toBeVisible({ timeout: 15000 });
			await expect(systemSection.getByRole('heading', { name: 'Jobs' })).toBeVisible();
			await expect(systemSection.getByRole('heading', { name: 'Cron Schedules' })).toBeVisible();
		});
	});

	// ============================================
	// Queue Jobs — Collection API (read-only via API)
	// ============================================
	test.describe('Queue Jobs — Collection API', () => {
		let adminContext: APIRequestContext;

		test.beforeAll(async ({ playwright, workerBaseURL }) => {
			adminContext = await playwright.request.newContext({
				baseURL: workerBaseURL,
				extraHTTPHeaders: { Origin: workerBaseURL },
			});
			const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
		});

		test.afterAll(async () => {
			await adminContext?.dispose();
		});

		test('GET /api/queue-jobs returns job listing for admin', async () => {
			const response = await adminContext.get('/api/queue-jobs');
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { docs: unknown[]; totalDocs: number };
			expect(Array.isArray(body.docs)).toBe(true);
			expect(typeof body.totalDocs).toBe('number');
		});

		test('POST /api/queue-jobs is denied (jobs created via adapter only)', async () => {
			const response = await adminContext.post('/api/queue-jobs', {
				data: {
					type: 'test:e2e-job',
					status: 'pending',
					queue: 'default',
					priority: 5,
					attempts: 0,
					maxRetries: 3,
					timeout: 30000,
				},
			});
			expect(response.status()).toBe(403);
		});

		test('denies unauthenticated read access', async ({ playwright, workerBaseURL }) => {
			const anonContext = await playwright.request.newContext({ baseURL: workerBaseURL });
			const response = await anonContext.get('/api/queue-jobs');
			expect(response.status()).toBe(403);
			await anonContext.dispose();
		});
	});

	// ============================================
	// Queue Admin API (/api/queue/*)
	// ============================================
	test.describe('Queue Admin API', () => {
		let adminContext: APIRequestContext;

		test.beforeAll(async ({ playwright, workerBaseURL }) => {
			adminContext = await playwright.request.newContext({
				baseURL: workerBaseURL,
				extraHTTPHeaders: { Origin: workerBaseURL },
			});
			const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
		});

		test.afterAll(async () => {
			await adminContext?.dispose();
		});

		test('GET /api/queue/stats returns queue statistics', async () => {
			const response = await adminContext.get('/api/queue/stats');
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { stats: unknown };
			expect(body.stats).toBeDefined();
		});

		test('GET /api/queue/jobs returns job listing', async () => {
			const response = await adminContext.get('/api/queue/jobs');
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { jobs: unknown[]; total: number };
			expect(Array.isArray(body.jobs)).toBe(true);
			expect(typeof body.total).toBe('number');
		});

		test('GET /api/queue/jobs supports status filter', async () => {
			const response = await adminContext.get('/api/queue/jobs?status=pending');
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { jobs: unknown[] };
			expect(Array.isArray(body.jobs)).toBe(true);
		});

		test('GET /api/queue/jobs/:id returns 404 for missing job', async () => {
			const response = await adminContext.get('/api/queue/jobs/nonexistent-id');
			expect(response.status()).toBe(404);
		});

		test('denies unauthenticated access to queue admin API', async ({
			playwright,
			workerBaseURL,
		}) => {
			const anonContext = await playwright.request.newContext({ baseURL: workerBaseURL });
			const response = await anonContext.get('/api/queue/stats');
			expect(response.status()).toBe(401);
			await anonContext.dispose();
		});

		test('denies non-admin access to queue admin API', async ({ playwright, workerBaseURL }) => {
			const editorContext = await playwright.request.newContext({
				baseURL: workerBaseURL,
				extraHTTPHeaders: { Origin: workerBaseURL },
			});
			const signIn = await editorContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_EDITOR_CREDENTIALS.email,
					password: TEST_EDITOR_CREDENTIALS.password,
				},
			});
			expect(signIn.ok(), 'Editor sign-in must succeed').toBe(true);

			const response = await editorContext.get('/api/queue/stats');
			expect(response.status()).toBe(403);
			await editorContext.dispose();
		});
	});

	// ============================================
	// Cron Schedules — Collection API (CRUD)
	// ============================================
	test.describe('Cron Schedules — Collection API', () => {
		let adminContext: APIRequestContext;
		let scheduleId: string;

		test.beforeAll(async ({ playwright, workerBaseURL }) => {
			adminContext = await playwright.request.newContext({
				baseURL: workerBaseURL,
				extraHTTPHeaders: { Origin: workerBaseURL },
			});
			const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_CREDENTIALS.email,
					password: TEST_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
		});

		test.afterAll(async () => {
			await adminContext?.dispose();
		});

		test('GET /api/cron-schedules returns list', async () => {
			const response = await adminContext.get('/api/cron-schedules');
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { docs: unknown[]; totalDocs: number };
			expect(Array.isArray(body.docs)).toBe(true);
		});

		test('POST /api/cron-schedules creates a schedule', async () => {
			const response = await adminContext.post('/api/cron-schedules', {
				data: {
					name: 'e2e-test-cleanup',
					type: 'maintenance:cleanup',
					cron: '0 2 * * *',
					queue: 'default',
					priority: 5,
					maxRetries: 3,
					timeout: 30000,
					enabled: true,
				},
			});
			expect(response.status()).toBe(201);
			const body = (await response.json()) as {
				doc: { id: string; name: string; cron: string };
			};
			expect(body.doc.id).toBeTruthy();
			expect(body.doc.name).toBe('e2e-test-cleanup');
			expect(body.doc.cron).toBe('0 2 * * *');
			scheduleId = body.doc.id;
		});

		test('GET /api/cron-schedules/:id returns the created schedule', async () => {
			const response = await adminContext.get(`/api/cron-schedules/${scheduleId}`);
			expect(response.status()).toBe(200);
			const body = (await response.json()) as {
				doc: { id: string; name: string; enabled: boolean };
			};
			expect(body.doc.id).toBe(scheduleId);
			expect(body.doc.name).toBe('e2e-test-cleanup');
			expect(body.doc.enabled).toBe(true);
		});

		test('PATCH /api/cron-schedules/:id disables the schedule', async () => {
			const response = await adminContext.patch(`/api/cron-schedules/${scheduleId}`, {
				data: { enabled: false },
			});
			expect(response.status()).toBe(200);
			const body = (await response.json()) as { doc: { enabled: boolean } };
			expect(body.doc.enabled).toBe(false);
		});

		test('DELETE /api/cron-schedules/:id removes the schedule', async () => {
			const response = await adminContext.delete(`/api/cron-schedules/${scheduleId}`);
			expect(response.status()).toBe(200);

			const verify = await adminContext.get(`/api/cron-schedules/${scheduleId}`);
			expect(verify.status()).toBe(404);
		});

		test('denies unauthenticated access to cron-schedules', async ({
			playwright,
			workerBaseURL,
		}) => {
			const anonContext = await playwright.request.newContext({ baseURL: workerBaseURL });
			const response = await anonContext.get('/api/cron-schedules');
			expect(response.status()).toBe(403);
			await anonContext.dispose();
		});
	});

	// ============================================
	// Admin UI — Queue Jobs collection navigation
	// ============================================
	test.describe('Admin UI — Queue Jobs collection list', () => {
		test('should navigate to queue-jobs collection via sidebar', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const nav = authenticatedPage.getByLabel('Main navigation');
			await expect(nav).toBeVisible({ timeout: 15000 });

			const jobsLink = nav.getByRole('link', { name: 'Jobs' });
			await expect(jobsLink).toBeVisible({ timeout: 10000 });
			await jobsLink.click();

			await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/queue-jobs/, {
				timeout: 10000,
			});

			const heading = authenticatedPage.getByRole('heading', { name: 'Jobs' });
			await expect(heading).toBeVisible({ timeout: 15000 });
		});
	});

	// ============================================
	// Admin UI — Cron Schedules collection navigation
	// ============================================
	test.describe('Admin UI — Cron Schedules collection list', () => {
		test('should navigate to cron-schedules collection via sidebar', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const nav = authenticatedPage.getByLabel('Main navigation');
			await expect(nav).toBeVisible({ timeout: 15000 });

			// Two "Cron Schedules" links exist (collection + plugin admin route); target the collection link
			const cronLink = nav.locator('a[href*="/collections/cron-schedules"]', {
				hasText: 'Cron Schedules',
			});
			await expect(cronLink).toBeVisible({ timeout: 10000 });
			await cronLink.click();

			await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/cron-schedules/, {
				timeout: 10000,
			});

			const heading = authenticatedPage.getByRole('heading', { name: 'Cron Schedules' });
			await expect(heading).toBeVisible({ timeout: 15000 });
		});
	});
});

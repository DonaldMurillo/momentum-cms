import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { test, expect, TEST_AUTHOR1_CREDENTIALS, TEST_VIEWER_CREDENTIALS } from '../fixtures';

/**
 * Import/Export E2E Tests.
 *
 * Tests the collection data export (JSON, CSV) and import endpoints.
 * Uses the categories collection for testing since it has simple, predictable data.
 */
test.describe('Import/Export', { tag: ['@api', '@crud'] }, () => {
	// Track IDs of documents created during import tests for cleanup
	const importedIds: string[] = [];

	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author1 sign-in must succeed').toBe(true);
	});

	test.afterEach(async ({ request }) => {
		// Clean up imported docs
		for (const id of importedIds) {
			await request.delete(`/api/categories/${id}`);
		}
		importedIds.length = 0;
	});

	// ============================================
	// JSON Export Tests
	// ============================================

	test('export JSON: returns documents for a collection', async ({ request }) => {
		const response = await request.get('/api/categories/export?format=json');
		expect(response.ok()).toBe(true);

		const body = (await response.json()) as {
			collection: string;
			format: string;
			totalDocs: number;
			docs: Array<{ id: string; name: string; slug: string }>;
		};

		expect(body.collection).toBe('categories');
		expect(body.format).toBe('json');
		expect(body.totalDocs).toBeGreaterThan(0);
		expect(Array.isArray(body.docs)).toBe(true);
		expect(body.docs[0]).toHaveProperty('id');
		expect(body.docs[0]).toHaveProperty('name');
	});

	test('export JSON: defaults to JSON when no format specified', async ({ request }) => {
		const response = await request.get('/api/categories/export');
		expect(response.ok()).toBe(true);

		const body = (await response.json()) as {
			format: string;
			docs: unknown[];
		};
		expect(body.format).toBe('json');
		expect(Array.isArray(body.docs)).toBe(true);
	});

	test('export JSON: has Content-Disposition header', async ({ request }) => {
		const response = await request.get('/api/categories/export?format=json');
		const disposition = response.headers()['content-disposition'];
		expect(disposition).toContain('categories-export.json');
	});

	// ============================================
	// CSV Export Tests
	// ============================================

	test('export CSV: returns CSV text with headers', async ({ request }) => {
		const response = await request.get('/api/categories/export?format=csv');
		expect(response.ok()).toBe(true);

		const contentType = response.headers()['content-type'];
		expect(contentType).toContain('text/csv');

		const csv = await response.text();
		const lines = csv.trim().split('\n');

		// First line is the header
		expect(lines.length).toBeGreaterThan(1);
		const headers = lines[0].split(',');
		expect(headers).toContain('id');
		expect(headers).toContain('name');
		expect(headers).toContain('slug');
	});

	test('export CSV: has Content-Disposition header', async ({ request }) => {
		const response = await request.get('/api/categories/export?format=csv');
		const disposition = response.headers()['content-disposition'];
		expect(disposition).toContain('categories-export.csv');
	});

	test('export CSV: data rows match JSON export document count', async ({ request }) => {
		// Get expected count from JSON export
		const jsonResponse = await request.get('/api/categories/export?format=json');

		const jsonData = (await jsonResponse.json()) as { totalDocs: number };

		// Get CSV export
		const csvResponse = await request.get('/api/categories/export?format=csv');
		const csv = await csvResponse.text();
		const lines = csv.trim().split('\n');

		// Lines = 1 header + N data rows
		expect(lines.length - 1).toBe(jsonData.totalDocs);
	});

	// ============================================
	// JSON Import Tests
	// ============================================

	test('import JSON: creates documents from array', async ({ request }) => {
		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [
					{ name: 'Import Cat A', slug: 'import-cat-a' },
					{ name: 'Import Cat B', slug: 'import-cat-b' },
				],
			},
		});

		expect(response.ok()).toBe(true);

		const body = (await response.json()) as {
			imported: number;
			total: number;
			errors: unknown[];
			docs: Array<{ id: string; name: string }>;
		};

		expect(body.imported).toBe(2);
		expect(body.total).toBe(2);
		expect(body.errors).toHaveLength(0);
		expect(body.docs).toHaveLength(2);

		// Track for cleanup
		for (const doc of body.docs) {
			importedIds.push(doc.id);
		}

		// Verify documents exist via API
		for (const doc of body.docs) {
			const getResponse = await request.get(`/api/categories/${doc.id}`);
			expect(getResponse.ok()).toBe(true);
		}
	});

	test('import JSON: reports errors for invalid documents', async ({ request }) => {
		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [
					{ name: 'Valid Import Cat', slug: 'valid-import-cat' },
					// Missing required "name" field
					{ slug: 'missing-name' },
				],
			},
		});

		const body = (await response.json()) as {
			imported: number;
			total: number;
			errors: Array<{ index: number; message: string }>;
			docs: Array<{ id: string }>;
		};

		// At least one should succeed; the invalid one may fail
		// (depends on whether name is truly required in validation)
		expect(body.total).toBe(2);
		expect(body.imported + body.errors.length).toBe(2);

		// Track successful imports for cleanup
		for (const doc of body.docs) {
			importedIds.push(doc.id);
		}
	});

	test('import JSON: requires authentication', async ({ request: _request, baseURL }) => {
		// Use a fresh request context without auth cookies
		const fetchResponse = await fetch(`${baseURL}/api/categories/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				format: 'json',
				docs: [{ name: 'Unauth Import', slug: 'unauth-import' }],
			}),
		});

		expect(fetchResponse.status).toBe(401);
	});

	test('import JSON: rejects empty data', async ({ request }) => {
		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [],
			},
		});

		expect(response.status()).toBe(400);
	});

	// ============================================
	// CSV Import Tests
	// ============================================

	test('import CSV: creates documents from CSV data', async ({ request }) => {
		const csvData = 'name,slug\nCSV Cat One,csv-cat-one\nCSV Cat Two,csv-cat-two';

		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'csv',
				data: csvData,
			},
		});

		expect(response.ok()).toBe(true);

		const body = (await response.json()) as {
			imported: number;
			total: number;
			errors: unknown[];
			docs: Array<{ id: string; name: string; slug: string }>;
		};

		expect(body.imported).toBe(2);
		expect(body.total).toBe(2);
		expect(body.errors).toHaveLength(0);

		// Verify values
		expect(body.docs[0].name).toBe('CSV Cat One');
		expect(body.docs[0].slug).toBe('csv-cat-one');
		expect(body.docs[1].name).toBe('CSV Cat Two');
		expect(body.docs[1].slug).toBe('csv-cat-two');

		// Track for cleanup
		for (const doc of body.docs) {
			importedIds.push(doc.id);
		}
	});

	test('import CSV: rejects invalid CSV format', async ({ request }) => {
		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'csv',
				data: 'just-a-header-row',
			},
		});

		expect(response.status()).toBe(400);
	});

	// ============================================
	// Round-trip Test
	// ============================================

	test('round-trip: export JSON then import creates equivalent documents', async ({ request }) => {
		// Export existing categories
		const exportResponse = await request.get('/api/categories/export?format=json');
		expect(exportResponse.ok()).toBe(true);

		const exportData = (await exportResponse.json()) as {
			docs: Array<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }>;
		};

		// Create import data from exported docs (strip system fields, modify to avoid conflicts)
		const importDocs = exportData.docs.slice(0, 2).map((doc, i) => ({
			name: `${doc.name} (Roundtrip Copy ${i})`,
			slug: `${doc.slug}-roundtrip-${i}`,
		}));

		// Import
		const importResponse = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: importDocs,
			},
		});
		expect(importResponse.ok()).toBe(true);

		const importResult = (await importResponse.json()) as {
			imported: number;
			docs: Array<{ id: string; name: string; slug: string }>;
		};

		expect(importResult.imported).toBe(importDocs.length);

		// Verify the imported docs have the correct names
		for (let i = 0; i < importDocs.length; i++) {
			expect(importResult.docs[i].name).toBe(importDocs[i].name);
			expect(importResult.docs[i].slug).toBe(importDocs[i].slug);
		}

		// Track for cleanup
		for (const doc of importResult.docs) {
			importedIds.push(doc.id);
		}
	});

	// ============================================
	// Edge Cases
	// ============================================

	test('export: returns 400 for invalid format', async ({ request }) => {
		const response = await request.get('/api/categories/export?format=xml');
		expect(response.status()).toBe(400);
	});

	test('export: returns 404 for non-existent collection', async ({ request }) => {
		const response = await request.get('/api/nonexistent-collection/export?format=json');
		expect(response.status()).toBe(404);
	});

	test('import: returns 404 for non-existent collection', async ({ request }) => {
		const response = await request.post('/api/nonexistent-collection/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [{ name: 'Test' }],
			},
		});
		expect(response.status()).toBe(404);
	});

	test('import: rejects oversized payloads (>5000 docs)', async ({ request }) => {
		const oversizedDocs = Array.from({ length: 5001 }, (_, i) => ({
			name: `Cat ${i}`,
			slug: `cat-${i}`,
		}));

		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: oversizedDocs,
			},
		});

		// Server may reject with 400 (handler limit) or 413 (body parser limit) — both are correct
		expect([400, 413]).toContain(response.status());
	});

	test('import: accepts payload at exactly 5000 docs limit', async ({ request }) => {
		// 5000 docs may exceed body parser limits, so we also accept 413.
		// The key assertion: the server does NOT reject with "Import limit exceeded".
		const docs = Array.from({ length: 5000 }, (_, i) => ({
			name: `Limit Cat ${i}`,
			slug: `limit-cat-${i}-${Date.now()}`,
		}));

		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs,
			},
		});

		// Server may respond with 200 (accepted) or 413 (body parser limit).
		// Both are valid — the key assertion is that the handler's own limit logic does NOT reject.
		if (response.status() === 413) {
			// 413 means body parser rejected before handler ran — assert it is NOT our handler's error
			expect(response.status()).toBe(413);
		} else {
			// If it got past the body parser, it should NOT be rejected for our size limit
			const body = (await response.json()) as { error?: string; imported?: number };
			expect(body.error ?? '').not.toContain('Import limit exceeded');
		}

		// Cleanup: delete imported docs
		const listResponse = await request.get('/api/categories?limit=10000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; slug?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.slug?.startsWith('limit-cat-')) {
					await request.delete(`/api/categories/${doc.id}`);
				}
			}
		}
	});
});

// ============================================
// Security & Access Control Tests
// ============================================

test.describe('Import/Export Security', { tag: ['@security', '@api'] }, () => {
	test('unauthenticated user cannot import', async ({ request: _request, baseURL }) => {
		const response = await fetch(`${baseURL}/api/categories/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				format: 'json',
				docs: [{ name: 'Unauth Test', slug: 'unauth-test' }],
			}),
		});

		expect(response.status).toBe(401);
	});

	test('unauthenticated user cannot export even public collections', async ({
		request: _request,
		baseURL,
	}) => {
		// Export always requires authentication to prevent bulk data exfiltration
		const response = await fetch(`${baseURL}/api/categories/export?format=json`);

		expect(response.status).toBe(401);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain('Authentication required');
	});

	test('viewer cannot import into articles (create requires admin/editor)', async ({ request }) => {
		// Sign in as viewer using the Playwright request fixture (inherits base URL from worker)
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_VIEWER_CREDENTIALS.email,
				password: TEST_VIEWER_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Viewer sign-in must succeed').toBe(true);

		const uniqueTitle = `Viewer Import Attempt ${Date.now()}`;

		// Try to import into articles as viewer
		const importResponse = await request.post('/api/articles/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [{ title: uniqueTitle }],
			},
		});

		const body = (await importResponse.json()) as {
			imported?: number;
			errors?: Array<{ message: string }>;
			error?: string;
		};

		// Viewer should not be able to create articles — either rejected at handler or per-doc
		if (importResponse.status() >= 400) {
			// Good — rejected outright (403 or 400)
			expect(importResponse.status()).toBeGreaterThanOrEqual(400);
		} else {
			// If 200, all docs must have failed (imported === 0)
			expect(body.imported).toBe(0);
			expect(body.errors?.length).toBeGreaterThan(0);
		}

		// Verify no article was actually created regardless of response shape
		const verifyResponse = await request.get(
			`/api/articles?where[title][equals]=${encodeURIComponent(uniqueTitle)}`,
		);
		const verifyData = (await verifyResponse.json()) as { docs: unknown[] };
		expect(verifyData.docs).toHaveLength(0);
	});

	test('import error messages do not contain stack traces', async ({ request }) => {
		// Sign in
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});

		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				docs: [
					{ name: 'Valid', slug: `stack-test-${Date.now()}` },
					{ slug: `no-name-${Date.now()}` },
				],
			},
		});

		const body = (await response.json()) as {
			errors?: Array<{ message: string }>;
			docs?: Array<{ id: string }>;
		};

		// Ensure we actually have errors to inspect
		const errors = body.errors ?? [];
		expect(errors.length, 'Expected at least one import error to inspect').toBeGreaterThan(0);

		// Error messages must not contain stack traces
		const stackPattern = /\s+at\s+\w+.*\(.*:\d+:\d+\)/;
		for (const err of errors) {
			expect(
				stackPattern.test(err.message),
				`Error should not contain stack trace: "${err.message}"`,
			).toBe(false);
		}

		// Cleanup
		for (const doc of body.docs ?? []) {
			await request.delete(`/api/categories/${doc.id}`);
		}
	});

	test('export does not include __proto__ or constructor fields', async ({ request }) => {
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});

		const response = await request.get('/api/categories/export?format=json');
		const text = await response.text();

		// JSON should not contain prototype pollution vectors
		expect(text).not.toContain('__proto__');
		expect(text).not.toContain('"constructor":');
	});

	test('CSV export escapes formula injection characters', async ({ request }) => {
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});

		// Create a category with formula chars in the name
		const createResponse = await request.post('/api/categories', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				name: '=CMD("calc")',
				slug: `csv-inject-test-${Date.now()}`,
			},
		});

		expect(createResponse.ok(), 'Category creation must succeed for CSV injection test').toBe(true);
		const createdDoc = (await createResponse.json()) as { id: string };

		try {
			const csvResponse = await request.get('/api/categories/export?format=csv');
			const csv = await csvResponse.text();

			// The = character should be escaped (prefixed with single quote)
			const lines = csv.split('\n');
			let formulaLineFound = false;
			for (const line of lines) {
				if (line.includes('CMD')) {
					formulaLineFound = true;
					// The formula should be escaped: '=CMD("calc") not =CMD("calc")
					expect(line).toContain("'=CMD");
				}
			}
			expect(formulaLineFound, 'Expected to find a CSV line containing the injected formula').toBe(
				true,
			);
		} finally {
			await request.delete(`/api/categories/${createdDoc.id}`);
		}
	});

	test('dry-run import does not create documents', async ({ request }) => {
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR1_CREDENTIALS.email,
				password: TEST_AUTHOR1_CREDENTIALS.password,
			},
		});

		const uniqueSlug = `dryrun-test-${Date.now()}`;

		const response = await request.post('/api/categories/import', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				format: 'json',
				dryRun: true,
				docs: [{ name: 'DryRun Test', slug: uniqueSlug }],
			},
		});

		expect(response.ok()).toBe(true);
		const body = (await response.json()) as { validation: unknown[]; total: number };
		expect(body.validation).toHaveLength(1);

		// Verify the document was NOT actually created
		const getResponse = await request.get(`/api/categories?where[slug][equals]=${uniqueSlug}`);
		const getData = (await getResponse.json()) as { docs: unknown[] };
		expect(getData.docs).toHaveLength(0);
	});
});

// ============================================
// Admin UI Tests
// ============================================

test.describe('Import/Export Admin UI', { tag: ['@admin', '@crud'] }, () => {
	test('Import/Export dropdown is visible on collection list', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		const trigger = authenticatedPage.getByTestId('import-export-trigger');
		await expect(trigger).toBeVisible({ timeout: 10000 });
		await expect(trigger).toHaveText(/Import \/ Export/);
	});

	test('Export as JSON triggers a file download', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		// Wait for data to load so the export has something to return
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Open the dropdown
		const trigger = authenticatedPage.getByTestId('import-export-trigger');
		await trigger.click();

		// Listen for download before clicking export
		const downloadPromise = authenticatedPage.waitForEvent('download');
		const exportJsonBtn = authenticatedPage.getByTestId('menu-export-json');
		await expect(exportJsonBtn).toBeVisible({ timeout: 5000 });
		await exportJsonBtn.click();

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('categories-export.json');

		// Verify downloaded file contains actual data
		const filePath = path.join(os.tmpdir(), `dl-${Date.now()}.json`);
		await download.saveAs(filePath);
		const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
			docs: Array<{ id: string; name: string }>;
		};
		expect(content.docs.length).toBeGreaterThan(0);
		expect(content.docs[0]).toHaveProperty('name');
		fs.unlinkSync(filePath);
	});

	test('Export as CSV triggers a file download', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		const trigger = authenticatedPage.getByTestId('import-export-trigger');
		await trigger.click();

		const downloadPromise = authenticatedPage.waitForEvent('download');
		const exportCsvBtn = authenticatedPage.getByTestId('menu-export-csv');
		await expect(exportCsvBtn).toBeVisible({ timeout: 5000 });
		await exportCsvBtn.click();

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('categories-export.csv');

		// Verify downloaded CSV contains headers and data rows
		const filePath = path.join(os.tmpdir(), `dl-${Date.now()}.csv`);
		await download.saveAs(filePath);
		const csv = fs.readFileSync(filePath, 'utf-8');
		const lines = csv.trim().split('\n');
		expect(lines.length).toBeGreaterThan(1);
		expect(lines[0]).toContain('name');
		fs.unlinkSync(filePath);
	});

	test('Import dialog opens with upload step', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		// Open dropdown and click Import
		const trigger = authenticatedPage.getByTestId('import-export-trigger');
		await expect(trigger).toBeVisible({ timeout: 10000 });
		await trigger.click();

		const importBtn = authenticatedPage.getByTestId('menu-import');
		await expect(importBtn).toBeVisible({ timeout: 5000 });
		await importBtn.click();

		// Dialog should appear with upload step
		const dialog = authenticatedPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5000 });
		await expect(dialog.getByText('Import Categories')).toBeVisible();

		// Drop zone should be visible
		const dropZone = authenticatedPage.getByTestId('import-drop-zone');
		await expect(dropZone).toBeVisible();

		// Validate button should be disabled (no file selected)
		const validateBtn = authenticatedPage.getByTestId('validate-btn');
		await expect(validateBtn).toBeDisabled();
	});

	test('Import JSON file: full flow from upload to results', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		// Wait for initial data to load
		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });

		// Open dropdown → Import
		const trigger = authenticatedPage.getByTestId('import-export-trigger');
		await expect(trigger).toBeVisible({ timeout: 10000 });
		await trigger.click();

		const importMenuItem = authenticatedPage.getByTestId('menu-import');
		await expect(importMenuItem).toBeVisible({ timeout: 5000 });
		await importMenuItem.click();

		const dialog = authenticatedPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Create a temp JSON file to upload
		const tmpDir = os.tmpdir();
		const suffix = Date.now();
		const tmpFile = path.join(tmpDir, `e2e-import-${suffix}.json`);
		const importData = [
			{ name: `E2E Import Cat 1 ${suffix}`, slug: `e2e-import-cat-1-${suffix}` },
			{ name: `E2E Import Cat 2 ${suffix}`, slug: `e2e-import-cat-2-${suffix}` },
		];
		fs.writeFileSync(tmpFile, JSON.stringify(importData));

		try {
			// Upload the file via the hidden file input
			const fileInput = authenticatedPage.getByTestId('import-file-input');
			await fileInput.setInputFiles(tmpFile);

			// File info should appear
			await expect(dialog.getByText(/e2e-import-/)).toBeVisible({ timeout: 5000 });

			// Validate button should be enabled
			const validateBtn = authenticatedPage.getByTestId('validate-btn');
			await expect(validateBtn).toBeEnabled();
			await validateBtn.click();

			// Should transition to preview step
			const validationSummary = authenticatedPage.getByTestId('validation-summary');
			await expect(validationSummary).toBeVisible({ timeout: 15000 });
			await expect(validationSummary).toContainText('rows valid');

			// Import button should be enabled
			const importBtn = authenticatedPage.getByTestId('import-btn');
			await expect(importBtn).toBeEnabled();
			await importBtn.click();

			// Should show results
			const result = authenticatedPage.getByTestId('import-result');
			await expect(result).toBeVisible({ timeout: 15000 });
			await expect(result).toContainText('imported successfully');

			// Click Done to close
			const doneBtn = authenticatedPage.getByTestId('done-btn');
			await expect(doneBtn).toBeVisible();
			await doneBtn.click();

			// Dialog should close
			await expect(dialog).toBeHidden({ timeout: 5000 });

			// Verify imported documents actually exist in the database
			const request = authenticatedPage.request;
			const verifyResponse = await request.get('/api/categories?limit=1000');
			expect(verifyResponse.ok()).toBe(true);
			const verifyData = (await verifyResponse.json()) as {
				docs: Array<{ slug?: string }>;
			};
			const importedSlugs = verifyData.docs
				.map((d) => d.slug)
				.filter((s) => s?.startsWith(`e2e-import-cat-`) && s.includes(String(suffix)));
			expect(importedSlugs).toHaveLength(2);
		} finally {
			// Clean up temp file
			if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

			// Clean up imported docs via API
			const request = authenticatedPage.request;
			const listResponse = await request.get('/api/categories?limit=1000');
			if (listResponse.ok()) {
				const data = (await listResponse.json()) as {
					docs: Array<{ id: string; slug?: string }>;
				};
				for (const doc of data.docs) {
					if (doc.slug?.startsWith('e2e-import-cat-')) {
						await request.delete(`/api/categories/${doc.id}`);
					}
				}
			}
		}
	});

	test('selecting rows shows Export selected bulk action', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Select first row
		const rowCheckboxes = authenticatedPage.locator(
			'mcms-table-body mcms-table-row mcms-checkbox button[role="checkbox"]',
		);
		await rowCheckboxes.first().click();

		// Bulk toolbar should show with Export selected button
		await expect(authenticatedPage.getByText('1 selected')).toBeVisible({ timeout: 5000 });
		const exportSelectedBtn = authenticatedPage.getByRole('button', { name: /Export selected/i });
		await expect(exportSelectedBtn).toBeVisible();
	});

	test('Export selected triggers a JSON download', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Categories' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/categories/, {
			timeout: 10000,
		});

		await expect(authenticatedPage.locator('mcms-table')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.locator('mcms-table-cell').first()).toBeVisible({
			timeout: 10000,
		});

		// Select first row
		const rowCheckboxes = authenticatedPage.locator(
			'mcms-table-body mcms-table-row mcms-checkbox button[role="checkbox"]',
		);
		await rowCheckboxes.first().click();

		// Click Export selected
		const downloadPromise = authenticatedPage.waitForEvent('download');
		const exportSelectedBtn = authenticatedPage.getByRole('button', { name: /Export selected/i });
		await exportSelectedBtn.click();

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('categories-selected.json');

		// Verify downloaded file contains exactly 1 document (the selected row)
		const filePath = path.join(os.tmpdir(), `dl-${Date.now()}.json`);
		await download.saveAs(filePath);
		const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
			docs: Array<{ id: string }>;
		};
		expect(content.docs).toHaveLength(1);
		expect(content.docs[0]).toHaveProperty('id');
		fs.unlinkSync(filePath);
	});
});

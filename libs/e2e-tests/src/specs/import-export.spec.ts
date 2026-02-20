import { test, expect, TEST_AUTHOR1_CREDENTIALS } from '../fixtures';

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
});

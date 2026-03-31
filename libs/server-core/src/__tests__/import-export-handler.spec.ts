import { describe, it, expect, vi } from 'vitest';
import type { CollectionConfig } from '@momentumcms/core';
import type { ImportResult } from '../lib/import-export';
import {
	handleExportRequest,
	handleImportRequest,
	MAX_IMPORT_DOCS,
	MAX_EXPORT_DOCS,
	type ExportHandlerParams,
	type ImportHandlerParams,
} from '../lib/import-export-handler';

// ============================================
// Test Fixtures
// ============================================

const testCollection: CollectionConfig = {
	slug: 'products',
	labels: { singular: 'Product', plural: 'Products' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'price', type: 'number', label: 'Price' },
	],
};

const managedCollection: CollectionConfig = {
	slug: 'users',
	labels: { singular: 'User', plural: 'Users' },
	fields: [{ name: 'email', type: 'text', required: true, label: 'Email' }],
	managed: true,
};

const sampleDocs = [
	{ id: '1', title: 'Widget', price: 9.99, createdAt: '2026-01-01', updatedAt: '2026-01-02' },
	{ id: '2', title: 'Gadget', price: 19.99, createdAt: '2026-02-01', updatedAt: '2026-02-02' },
];

const testUser = { id: 'user-1', role: 'admin' };

function createMockApi(
	findResult = {
		docs: sampleDocs,
		totalDocs: 2,
		totalPages: 1,
		page: 1,
		limit: 10000,
		hasNextPage: false,
		hasPrevPage: false,
	},
) {
	const collectionOps = {
		find: vi.fn().mockResolvedValue(findResult),
		create: vi
			.fn()
			.mockImplementation((data: Record<string, unknown>) =>
				Promise.resolve({ id: `new-${Date.now()}`, ...data }),
			),
	};

	return {
		collection: vi.fn().mockReturnValue(collectionOps),
		setContext: vi.fn().mockReturnThis(),
		getConfig: vi.fn(),
		_collectionOps: collectionOps,
	};
}

function exportParams(overrides?: Partial<ExportHandlerParams>): ExportHandlerParams {
	return {
		collectionSlug: 'products',
		format: 'json',
		config: { collections: [testCollection] },
		api: createMockApi(),
		user: testUser,
		...overrides,
	};
}

function importParams(overrides?: Partial<ImportHandlerParams>): ImportHandlerParams {
	return {
		collectionSlug: 'products',
		format: 'json',
		body: { docs: [{ title: 'New Product', price: 5.99 }] },
		config: { collections: [testCollection] },
		api: createMockApi(),
		user: testUser,
		...overrides,
	};
}

// ============================================
// handleExportRequest
// ============================================

describe('handleExportRequest', () => {
	it('should return 200 with JSON docs', async () => {
		const result = await handleExportRequest(exportParams());

		expect(result.status).toBe(200);
		const body = result.body as {
			collection: string;
			format: string;
			totalDocs: number;
			docs: unknown[];
		};
		expect(body.collection).toBe('products');
		expect(body.format).toBe('json');
		expect(body.totalDocs).toBe(2);
		expect(body.docs).toEqual(sampleDocs);
	});

	it('should return 200 with CSV and Content-Disposition header', async () => {
		const result = await handleExportRequest(exportParams({ format: 'csv' }));

		expect(result.status).toBe(200);
		const headers = result.headers ?? {};
		expect(headers['Content-Type']).toBe('text/csv');
		expect(headers['Content-Disposition']).toContain('products-export.csv');
		expect(typeof result.body).toBe('string');
	});

	it('should return 404 for unknown collection slug', async () => {
		const result = await handleExportRequest(exportParams({ collectionSlug: 'nonexistent' }));

		expect(result.status).toBe(404);
		const body = result.body as { error: string };
		expect(body.error).toContain('nonexistent');
	});

	it('should return 400 for invalid format', async () => {
		const result = await handleExportRequest(exportParams({ format: 'xml' as 'json' | 'csv' }));

		expect(result.status).toBe(400);
	});

	it('should respect limit param', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ limit: 50, api: mockApi }));

		expect(mockApi._collectionOps.find).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 50 }),
		);
	});

	it('should set user context on API', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ api: mockApi, user: testUser }));

		expect(mockApi.setContext).toHaveBeenCalledWith({ user: testUser });
	});

	it('should return 401 when no user is provided (matching import handler security)', async () => {
		const mockApi = createMockApi();
		const result = await handleExportRequest(exportParams({ api: mockApi, user: undefined }));

		expect(result.status).toBe(401);
		const body = result.body as { error: string };
		expect(body.error).toContain('Authentication required');
		// Must NOT call the API at all — no data leakage
		expect(mockApi.collection).not.toHaveBeenCalled();
	});

	it('should cap limit to MAX_EXPORT_DOCS', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ api: mockApi, limit: 999999 }));

		const calledLimit = (mockApi._collectionOps.find as ReturnType<typeof vi.fn>).mock.calls[0][0]
			.limit;
		expect(calledLimit).toBeLessThanOrEqual(MAX_EXPORT_DOCS);
	});

	// Issue #2: NaN/negative limit must not bypass MAX_EXPORT_DOCS
	it('should treat NaN limit as MAX_EXPORT_DOCS', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ api: mockApi, limit: NaN }));

		const calledLimit = (mockApi._collectionOps.find as ReturnType<typeof vi.fn>).mock.calls[0][0]
			.limit;
		expect(calledLimit).toBe(MAX_EXPORT_DOCS);
	});

	it('should treat negative limit as MAX_EXPORT_DOCS', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ api: mockApi, limit: -1 }));

		const calledLimit = (mockApi._collectionOps.find as ReturnType<typeof vi.fn>).mock.calls[0][0]
			.limit;
		expect(calledLimit).toBeGreaterThan(0);
		expect(calledLimit).toBeLessThanOrEqual(MAX_EXPORT_DOCS);
	});

	it('should treat zero limit as MAX_EXPORT_DOCS', async () => {
		const mockApi = createMockApi();
		await handleExportRequest(exportParams({ api: mockApi, limit: 0 }));

		const calledLimit = (mockApi._collectionOps.find as ReturnType<typeof vi.fn>).mock.calls[0][0]
			.limit;
		expect(calledLimit).toBeGreaterThan(0);
		expect(calledLimit).toBeLessThanOrEqual(MAX_EXPORT_DOCS);
	});

	// Issue #4: Managed collections must be blocked from export
	it('should return 403 for managed collection export', async () => {
		const mockApi = createMockApi();
		const result = await handleExportRequest(
			exportParams({
				api: mockApi,
				collectionSlug: 'users',
				config: { collections: [testCollection, managedCollection] },
			}),
		);

		expect(result.status).toBe(403);
		const body = result.body as { error: string };
		expect(body.error).toContain('read-only');
	});
});

// ============================================
// handleImportRequest
// ============================================

describe('handleImportRequest', () => {
	it('should create docs and return ImportResult with 200', async () => {
		const result = await handleImportRequest(importParams());

		expect(result.status).toBe(200);
		const body = result.body as ImportResult;
		expect(body.imported).toBe(1);
		expect(body.total).toBe(1);
		expect(body.errors).toEqual([]);
		expect(body.docs).toHaveLength(1);
	});

	it('should return 401 when no user', async () => {
		const result = await handleImportRequest(importParams({ user: undefined }));

		expect(result.status).toBe(401);
	});

	it('should return 404 for unknown collection', async () => {
		const result = await handleImportRequest(importParams({ collectionSlug: 'nonexistent' }));

		expect(result.status).toBe(404);
	});

	it('should return 403 for managed collection import', async () => {
		const mockApi = createMockApi();
		const result = await handleImportRequest(
			importParams({
				api: mockApi,
				collectionSlug: 'users',
				config: { collections: [testCollection, managedCollection] },
				body: { docs: [{ email: 'evil@example.com' }] },
			}),
		);

		expect(result.status).toBe(403);
		const body = result.body as { error: string };
		expect(body.error).toContain('read-only');
		// Must NOT call create — no data written
		expect(mockApi._collectionOps.create).not.toHaveBeenCalled();
	});

	it('should return 400 for empty docs', async () => {
		const result = await handleImportRequest(importParams({ body: { docs: [] } }));

		expect(result.status).toBe(400);
	});

	it('should return 400 for parse error', async () => {
		const result = await handleImportRequest(
			importParams({
				body: 'not valid json input',
			}),
		);

		expect(result.status).toBe(400);
	});

	it('should handle partial success', async () => {
		const mockApi = createMockApi();
		mockApi._collectionOps.create
			.mockResolvedValueOnce({ id: '1', title: 'Good' })
			.mockRejectedValueOnce(new Error('Validation failed'));

		const result = await handleImportRequest(
			importParams({
				api: mockApi,
				body: { docs: [{ title: 'Good' }, { title: '' }] },
			}),
		);

		expect(result.status).toBe(200);
		const body = result.body as ImportResult;
		expect(body.imported).toBe(1);
		expect(body.total).toBe(2);
		expect(body.errors).toHaveLength(1);
		expect(body.errors[0].index).toBe(1);
	});

	it('should return 400 when all docs fail', async () => {
		const mockApi = createMockApi();
		mockApi._collectionOps.create.mockRejectedValue(new Error('fail'));

		const result = await handleImportRequest(
			importParams({
				api: mockApi,
				body: { docs: [{ title: 'A' }] },
			}),
		);

		expect(result.status).toBe(400);
		const body = result.body as ImportResult;
		expect(body.imported).toBe(0);
	});

	it('should validate without creating when dryRun=true', async () => {
		const mockApi = createMockApi();
		const result = await handleImportRequest(
			importParams({
				api: mockApi,
				dryRun: true,
				body: { docs: [{ title: 'Widget', price: 9.99 }] },
			}),
		);

		expect(result.status).toBe(200);
		// Should NOT have called create
		expect(mockApi._collectionOps.create).not.toHaveBeenCalled();

		const body = result.body as { validation: unknown[]; total: number };
		expect(body.validation).toHaveLength(1);
		expect(body.total).toBe(1);
	});

	it('should return per-row errors in dryRun mode', async () => {
		const result = await handleImportRequest(
			importParams({
				dryRun: true,
				body: { docs: [{ price: 9.99 }, { title: 'Good' }] }, // first missing required title
			}),
		);

		expect(result.status).toBe(200);
		const body = result.body as { validation: Array<{ valid: boolean; errors: unknown[] }> };
		expect(body.validation[0].valid).toBe(false);
		expect(body.validation[0].errors.length).toBeGreaterThan(0);
		expect(body.validation[1].valid).toBe(true);
	});

	it('should handle CSV import format', async () => {
		const result = await handleImportRequest(
			importParams({
				format: 'csv',
				body: { data: 'title,price\nWidget,9.99' },
			}),
		);

		expect(result.status).toBe(200);
		const body = result.body as ImportResult;
		expect(body.imported).toBe(1);
	});

	it('should return 400 for CSV without data field', async () => {
		const result = await handleImportRequest(
			importParams({
				format: 'csv',
				body: { docs: [{ title: 'Widget' }] },
			}),
		);

		expect(result.status).toBe(400);
	});

	it('should return 400 when import exceeds MAX_IMPORT_DOCS limit', async () => {
		const oversizedDocs = Array.from({ length: MAX_IMPORT_DOCS + 1 }, (_, i) => ({
			title: `Doc ${i}`,
		}));

		const result = await handleImportRequest(
			importParams({
				body: { docs: oversizedDocs },
			}),
		);

		expect(result.status).toBe(400);
		const body = result.body as { error: string };
		expect(body.error).toContain('Import limit exceeded');
		expect(body.error).toContain(String(MAX_IMPORT_DOCS));
	});

	it('should only create docs that passed validation (skip invalid rows)', async () => {
		const mockApi = createMockApi();

		const result = await handleImportRequest(
			importParams({
				api: mockApi,
				body: {
					docs: [
						{ title: 'Good One', price: 9.99 },
						{ price: 'not-valid' }, // missing required 'title'
						{ title: 'Good Two', price: 5.99 },
					],
				},
			}),
		);

		expect(result.status).toBe(200);
		const body = result.body as ImportResult;
		// Handler should only attempt to create valid docs (2), not all 3
		expect(mockApi._collectionOps.create).toHaveBeenCalledTimes(2);
		expect(body.imported).toBe(2);
		expect(body.errors).toHaveLength(1);
		expect(body.errors[0].index).toBe(1);
	});

	it('should accept import at exactly MAX_IMPORT_DOCS', async () => {
		const exactDocs = Array.from({ length: MAX_IMPORT_DOCS }, (_, i) => ({
			title: `Doc ${i}`,
		}));

		const result = await handleImportRequest(
			importParams({
				body: { docs: exactDocs },
			}),
		);

		// Should not be rejected for size — status depends on create success
		expect(result.status).not.toBe(400);
	});
});

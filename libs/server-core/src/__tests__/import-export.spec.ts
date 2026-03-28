import { describe, it, expect } from 'vitest';
import type { CollectionConfig } from '@momentumcms/core';
import {
	exportToJson,
	exportToCsv,
	parseJsonImport,
	parseCsvImport,
	validateImportDocs,
} from '../lib/import-export';

// ============================================
// Test Fixtures
// ============================================

const testCollection: CollectionConfig = {
	slug: 'products',
	labels: { singular: 'Product', plural: 'Products' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'price', type: 'number', label: 'Price' },
		{ name: 'active', type: 'checkbox', label: 'Active' },
		{ name: 'metadata', type: 'json', label: 'Metadata' },
		{
			name: 'category',
			type: 'select',
			options: [
				{ value: 'electronics', label: 'Electronics' },
				{ value: 'books', label: 'Books' },
			],
		},
	],
};

const versionedCollection: CollectionConfig = {
	slug: 'articles',
	fields: [{ name: 'title', type: 'text', required: true }],
	versions: { drafts: true },
};

const sampleDocs: Record<string, unknown>[] = [
	{
		id: '1',
		title: 'Widget',
		price: 9.99,
		active: true,
		category: 'electronics',
		createdAt: '2026-01-01',
		updatedAt: '2026-01-02',
	},
	{
		id: '2',
		title: 'Book',
		price: 14.99,
		active: false,
		category: 'books',
		createdAt: '2026-02-01',
		updatedAt: '2026-02-02',
	},
];

// ============================================
// exportToJson
// ============================================

describe('exportToJson', () => {
	it('should return format, totalDocs, docs, and contentType', () => {
		const result = exportToJson(sampleDocs, testCollection);

		expect(result.format).toBe('json');
		expect(result.totalDocs).toBe(2);
		expect(result.docs).toBe(sampleDocs);
		expect(result.contentType).toBe('application/json');
	});

	it('should handle empty docs array', () => {
		const result = exportToJson([], testCollection);

		expect(result.totalDocs).toBe(0);
		expect(result.docs).toEqual([]);
	});
});

// ============================================
// exportToCsv
// ============================================

describe('exportToCsv', () => {
	it('should produce header row from collection fields plus system fields', () => {
		const result = exportToCsv([], testCollection);
		const header = (result.data ?? '').split('\n')[0];

		// System fields come first, then data fields in order
		expect(header).toContain('id');
		expect(header).toContain('createdAt');
		expect(header).toContain('updatedAt');
		expect(header).toContain('title');
		expect(header).toContain('price');
		expect(header).toContain('active');
		expect(header).toContain('metadata');
		expect(header).toContain('category');
	});

	it('should include _status column for versioned collections with drafts', () => {
		const result = exportToCsv([], versionedCollection);
		const header = (result.data ?? '').split('\n')[0];

		expect(header).toContain('_status');
	});

	it('should not include _status column for non-versioned collections', () => {
		const result = exportToCsv([], testCollection);
		const header = (result.data ?? '').split('\n')[0];

		expect(header).not.toContain('_status');
	});

	it('should serialize data rows with correct values', () => {
		const result = exportToCsv(sampleDocs, testCollection);
		const lines = (result.data ?? '').split('\n');

		expect(lines.length).toBe(3); // header + 2 data rows
		expect(result.totalDocs).toBe(2);
		expect(result.format).toBe('csv');
		expect(result.contentType).toBe('text/csv');
	});

	it('should handle null and undefined values as empty strings', () => {
		const docs = [{ id: '1', title: null, price: undefined }];
		const result = exportToCsv(docs as Record<string, unknown>[], testCollection);
		const dataRow = (result.data ?? '').split('\n')[1];

		// null/undefined become empty string (no "null" or "undefined" text)
		expect(dataRow).not.toContain('null');
		expect(dataRow).not.toContain('undefined');
	});

	it('should serialize Date objects as ISO strings', () => {
		const date = new Date('2026-03-15T10:30:00.000Z');
		const docs = [{ id: '1', title: 'Test', createdAt: date }];
		const result = exportToCsv(docs, testCollection);
		const dataRow = (result.data ?? '').split('\n')[1];

		expect(dataRow).toContain('2026-03-15T10:30:00.000Z');
	});

	it('should serialize nested objects as quoted JSON strings', () => {
		const docs = [{ id: '1', title: 'Test', metadata: { color: 'red', size: 42 } }];
		const result = exportToCsv(docs, testCollection);
		const dataRow = (result.data ?? '').split('\n')[1];

		// Objects become JSON strings wrapped in quotes
		expect(dataRow).toContain('"');
		expect(dataRow).toContain('color');
	});

	it('should prevent CSV injection by prefixing formula chars with single quote', () => {
		const docs = [{ id: '1', title: '=SUM(A1:A10)' }];
		const result = exportToCsv(docs, testCollection);
		const dataRow = (result.data ?? '').split('\n')[1];

		// Formula should be prefixed with ' to prevent injection
		expect(dataRow).toContain("'=SUM(A1:A10)");
	});

	it('should prevent injection for +, -, @ prefixed values', () => {
		const plusDoc = [{ id: '1', title: '+cmd' }];
		const minusDoc = [{ id: '2', title: '-cmd' }];
		const atDoc = [{ id: '3', title: '@cmd' }];

		expect(exportToCsv(plusDoc, testCollection).data).toContain("'+cmd");
		expect(exportToCsv(minusDoc, testCollection).data).toContain("'-cmd");
		expect(exportToCsv(atDoc, testCollection).data).toContain("'@cmd");
	});

	it('should quote values containing commas', () => {
		const docs = [{ id: '1', title: 'Hello, World' }];
		const result = exportToCsv(docs, testCollection);

		expect(result.data).toContain('"Hello, World"');
	});

	it('should escape quotes inside values by doubling them', () => {
		const docs = [{ id: '1', title: 'Say "hello"' }];
		const result = exportToCsv(docs, testCollection);

		expect(result.data).toContain('"Say ""hello"""');
	});

	it('should quote values containing newlines', () => {
		const docs = [{ id: '1', title: 'Line1\nLine2' }];
		const result = exportToCsv(docs, testCollection);

		expect(result.data).toContain('"Line1\nLine2"');
	});
});

// ============================================
// parseJsonImport
// ============================================

describe('parseJsonImport', () => {
	it('should accept an array directly', () => {
		const input = [{ title: 'A' }, { title: 'B' }];
		const result = parseJsonImport(input);

		expect(result.docs).toEqual(input);
		expect(result.error).toBeUndefined();
	});

	it('should accept { docs: [...] } wrapper', () => {
		const docs = [{ title: 'A' }];
		const result = parseJsonImport({ docs });

		expect(result.docs).toEqual(docs);
		expect(result.error).toBeUndefined();
	});

	it('should accept { data: [...] } wrapper', () => {
		const data = [{ title: 'A' }];
		const result = parseJsonImport({ data });

		expect(result.docs).toEqual(data);
		expect(result.error).toBeUndefined();
	});

	it('should return error for a plain object without docs or data', () => {
		const result = parseJsonImport({ title: 'A' });

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});

	it('should return error for a string', () => {
		const result = parseJsonImport('not an array');

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});

	it('should return error for null', () => {
		const result = parseJsonImport(null);

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});

	it('should return error for a number', () => {
		const result = parseJsonImport(42);

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});
});

// ============================================
// parseCsvImport
// ============================================

describe('parseCsvImport', () => {
	it('should parse header + data rows into docs array', () => {
		const csv = 'title,price,active\nWidget,9.99,true\nBook,14.99,false';
		const result = parseCsvImport(csv, testCollection);

		expect(result.error).toBeUndefined();
		expect(result.docs).toHaveLength(2);
		expect(result.docs[0]).toEqual({ title: 'Widget', price: 9.99, active: true });
		expect(result.docs[1]).toEqual({ title: 'Book', price: 14.99, active: false });
	});

	it('should coerce number fields from string to number', () => {
		const csv = 'title,price\nTest,42';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['price']).toBe(42);
		expect(typeof result.docs[0]['price']).toBe('number');
	});

	it('should coerce checkbox fields to boolean', () => {
		const csv = 'title,active\nA,true\nB,1\nC,false\nD,0';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['active']).toBe(true);
		expect(result.docs[1]['active']).toBe(true);
		expect(result.docs[2]['active']).toBe(false);
		expect(result.docs[3]['active']).toBe(false);
	});

	it('should parse JSON fields from string', () => {
		const csv = 'title,metadata\nTest,"{""color"":""red""}"';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['metadata']).toEqual({ color: 'red' });
	});

	it('should keep invalid JSON as raw string for json fields', () => {
		const csv = 'title,metadata\nTest,not-json';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['metadata']).toBe('not-json');
	});

	it('should skip id, createdAt, updatedAt columns', () => {
		const csv = 'id,title,createdAt,updatedAt\n99,Widget,2026-01-01,2026-01-02';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]).toEqual({ title: 'Widget' });
		expect(result.docs[0]['id']).toBeUndefined();
		expect(result.docs[0]['createdAt']).toBeUndefined();
		expect(result.docs[0]['updatedAt']).toBeUndefined();
	});

	it('should skip empty values', () => {
		const csv = 'title,price\nWidget,';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]).toEqual({ title: 'Widget' });
		expect(result.docs[0]['price']).toBeUndefined();
	});

	it('should handle RFC 4180 quoted fields with commas', () => {
		const csv = 'title,price\n"Hello, World",9.99';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['title']).toBe('Hello, World');
	});

	it('should handle RFC 4180 escaped quotes (doubled)', () => {
		const csv = 'title,price\n"Say ""hello""",9.99';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['title']).toBe('Say "hello"');
	});

	it('should handle RFC 4180 newlines inside quoted fields', () => {
		const csv = 'title,price\n"Line1\nLine2",9.99';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['title']).toBe('Line1\nLine2');
	});

	it('should return error for empty string', () => {
		const result = parseCsvImport('', testCollection);

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});

	it('should return error for non-string input', () => {
		const result = parseCsvImport(null as unknown as string, testCollection);

		expect(result.docs).toEqual([]);
		expect(result.error).toBeDefined();
	});

	it('should return error for header-only CSV (no data rows)', () => {
		const csv = 'title,price';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs).toEqual([]);
		expect(result.error).toContain('header row and at least one data row');
	});

	it('should handle CRLF line endings', () => {
		const csv = 'title,price\r\nWidget,9.99\r\nBook,14.99';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs).toHaveLength(2);
		expect(result.docs[0]['title']).toBe('Widget');
	});

	it('should treat unknown field types as strings', () => {
		const csv = 'title,category\nWidget,electronics';
		const result = parseCsvImport(csv, testCollection);

		expect(result.docs[0]['category']).toBe('electronics');
		expect(typeof result.docs[0]['category']).toBe('string');
	});
});

// ============================================
// validateImportDocs
// ============================================

describe('validateImportDocs', () => {
	it('should return valid: true for docs matching the collection schema', () => {
		const docs = [{ title: 'Widget', price: 9.99, active: true }];
		const results = validateImportDocs(docs, testCollection);

		expect(results).toHaveLength(1);
		expect(results[0].index).toBe(0);
		expect(results[0].valid).toBe(true);
		expect(results[0].errors).toEqual([]);
		expect(results[0].coerced['title']).toBe('Widget');
	});

	it('should catch missing required fields', () => {
		const docs = [{ price: 9.99 }]; // missing required 'title'
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(false);
		expect(results[0].errors).toContainEqual(
			expect.objectContaining({ field: 'title', message: expect.stringContaining('required') }),
		);
	});

	it('should catch NaN for number fields', () => {
		const docs = [{ title: 'Widget', price: 'not-a-number' }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(false);
		expect(results[0].errors).toContainEqual(expect.objectContaining({ field: 'price' }));
	});

	it('should return coerced values for valid type conversions', () => {
		const docs = [{ title: 'Widget', price: '42', active: 'true' }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(true);
		expect(results[0].coerced['price']).toBe(42);
		expect(results[0].coerced['active']).toBe(true);
	});

	it('should ignore unknown fields without erroring', () => {
		const docs = [{ title: 'Widget', unknownField: 'whatever' }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(true);
		expect(results[0].coerced['unknownField']).toBe('whatever');
	});

	it('should validate multiple docs independently', () => {
		const docs = [
			{ title: 'Good' },
			{ price: 9.99 }, // missing required title
			{ title: 'Also Good' },
		];
		const results = validateImportDocs(docs, testCollection);

		expect(results).toHaveLength(3);
		expect(results[0].valid).toBe(true);
		expect(results[1].valid).toBe(false);
		expect(results[2].valid).toBe(true);
	});

	it('should return empty array for empty docs', () => {
		const results = validateImportDocs([], testCollection);
		expect(results).toEqual([]);
	});

	it('should catch invalid JSON for json fields', () => {
		const docs = [{ title: 'Widget', metadata: '{bad json' }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(false);
		expect(results[0].errors).toContainEqual(expect.objectContaining({ field: 'metadata' }));
	});

	it('should accept valid JSON strings for json fields', () => {
		const docs = [{ title: 'Widget', metadata: '{"color":"red"}' }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(true);
		expect(results[0].coerced['metadata']).toEqual({ color: 'red' });
	});

	it('should accept already-parsed objects for json fields', () => {
		const docs = [{ title: 'Widget', metadata: { color: 'red' } }];
		const results = validateImportDocs(docs, testCollection);

		expect(results[0].valid).toBe(true);
		expect(results[0].coerced['metadata']).toEqual({ color: 'red' });
	});
});

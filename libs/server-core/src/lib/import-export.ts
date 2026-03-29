/**
 * Import/Export module for Momentum CMS.
 *
 * Provides JSON and CSV export/import for collection documents.
 * - Export: Fetches all documents and serializes to JSON or CSV
 * - Import: Parses JSON or CSV data and creates documents via batch operations
 *
 * No external dependencies - uses built-in CSV serialization.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow parsed JSON body to Record types */

import type { CollectionConfig, Field } from '@momentumcms/core';
import { flattenDataFields } from '@momentumcms/core';

// ============================================
// Types
// ============================================

export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
	/** Export format (default: 'json') */
	format?: ExportFormat;
	/** Max documents to export (default: unlimited) */
	limit?: number;
}

export interface ExportResult {
	/** Format of the exported data */
	format: ExportFormat;
	/** Number of documents exported */
	totalDocs: number;
	/** For JSON format: the array of documents */
	docs?: Record<string, unknown>[];
	/** For CSV format: the CSV string */
	data?: string;
	/** Content-Type header value */
	contentType: string;
}

export interface ImportOptions {
	/** Import format (default: 'json') */
	format?: ExportFormat;
}

export interface ImportResult {
	/** Number of successfully imported documents */
	imported: number;
	/** Total items attempted */
	total: number;
	/** Error details for failed items */
	errors: ImportError[];
	/** Successfully created documents */
	docs: Record<string, unknown>[];
}

export interface ImportError {
	/** Index of the item in the import data */
	index: number;
	/** Error message */
	message: string;
	/** The data that failed to import */
	data?: Record<string, unknown>;
}

// ============================================
// CSV Utilities
// ============================================

/**
 * Escape a CSV value (RFC 4180 compliant).
 * Wraps in quotes if the value contains commas, newlines, or quotes.
 */
function escapeCsvValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}

	// Handle Date objects - serialize as ISO string
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === 'object') {
		// Serialize arrays/objects as JSON strings
		const jsonStr = JSON.stringify(value);
		return `"${jsonStr.replace(/"/g, '""')}"`;
	}

	let str = String(value);

	// Prevent CSV injection: prefix formula-triggering characters with a single quote
	// and ALWAYS wrap in double quotes so spreadsheets treat it as a literal string
	if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
		str = `'${str}`;
		return `"${str.replace(/"/g, '""')}"`;
	}

	if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Parse a CSV string into rows of values.
 * Handles quoted fields, escaped quotes, and newlines within quotes.
 */
function parseCsv(csv: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentField = '';
	let inQuotes = false;
	let fieldStart = true; // tracks whether we're at the beginning of a field
	let i = 0;

	while (i < csv.length) {
		const char = csv[i];

		if (inQuotes) {
			if (char === '"') {
				// Check for escaped quote
				if (i + 1 < csv.length && csv[i + 1] === '"') {
					currentField += '"';
					i += 2;
					continue;
				}
				// End of quoted field
				inQuotes = false;
				i++;
				continue;
			}
			currentField += char;
			i++;
		} else {
			if (char === '"' && fieldStart) {
				// Only enter quoted mode at the start of a field (RFC 4180)
				inQuotes = true;
				fieldStart = false;
				i++;
			} else if (char === ',') {
				currentRow.push(currentField);
				currentField = '';
				fieldStart = true;
				i++;
			} else if (
				char === '\n' ||
				(char === '\r' && csv[i + 1] === '\n') ||
				(char === '\r' && csv[i + 1] !== '\n')
			) {
				currentRow.push(currentField);
				currentField = '';
				fieldStart = true;
				if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
					rows.push(currentRow);
				}
				currentRow = [];
				i += char === '\r' && csv[i + 1] === '\n' ? 2 : 1;
			} else {
				currentField += char;
				fieldStart = false;
				i++;
			}
		}
	}

	// Don't forget the last field/row
	currentRow.push(currentField);
	if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
		rows.push(currentRow);
	}

	return rows;
}

// ============================================
// Field Extraction
// ============================================

/**
 * Get the flat data field names for a collection (excluding layout fields).
 * Returns names of fields that store data in the database.
 */
function getExportFieldNames(collection: CollectionConfig): string[] {
	const dataFields = flattenDataFields(collection.fields);
	const names = dataFields.map((f: Field) => f.name);

	// Always include system fields
	const systemFields = ['id', 'createdAt', 'updatedAt'];
	for (const sf of systemFields) {
		if (!names.includes(sf)) {
			names.unshift(sf);
		}
	}

	// Include _status for versioned collections with drafts
	if (
		collection.versions &&
		typeof collection.versions === 'object' &&
		collection.versions.drafts
	) {
		if (!names.includes('_status')) {
			names.push('_status');
		}
	}

	return names;
}

// ============================================
// Export Functions
// ============================================

/**
 * Export documents from a collection as JSON.
 */
export function exportToJson(
	docs: Record<string, unknown>[],
	_collection: CollectionConfig,
): ExportResult {
	return {
		format: 'json',
		totalDocs: docs.length,
		docs,
		contentType: 'application/json',
	};
}

/**
 * Export documents from a collection as CSV.
 */
export function exportToCsv(
	docs: Record<string, unknown>[],
	collection: CollectionConfig,
): ExportResult {
	const fieldNames = getExportFieldNames(collection);

	// Header row
	const header = fieldNames.map(escapeCsvValue).join(',');

	// Data rows
	const dataRows = docs.map((doc) => fieldNames.map((name) => escapeCsvValue(doc[name])).join(','));

	const csvData = [header, ...dataRows].join('\n');

	return {
		format: 'csv',
		totalDocs: docs.length,
		data: csvData,
		contentType: 'text/csv',
	};
}

// ============================================
// Import Functions
// ============================================

/**
 * Parse JSON import data into document records.
 * Accepts either an array of objects or `{ docs: [...] }`.
 */
export function parseJsonImport(body: unknown): {
	docs: Record<string, unknown>[];
	error?: string;
} {
	if (Array.isArray(body)) {
		return { docs: body };
	}

	if (typeof body === 'object' && body !== null) {
		const obj = body as Record<string, unknown>;
		if (Array.isArray(obj['docs'])) {
			return { docs: obj['docs'] as Record<string, unknown>[] };
		}
		if (Array.isArray(obj['data'])) {
			return { docs: obj['data'] as Record<string, unknown>[] };
		}
	}

	return { docs: [], error: 'Invalid JSON import data. Expected an array or { docs: [...] }' };
}

/**
 * Parse CSV import data into document records.
 * First row is treated as header (field names).
 */
export function parseCsvImport(
	csvData: string,
	collection: CollectionConfig,
): { docs: Record<string, unknown>[]; error?: string } {
	if (!csvData || typeof csvData !== 'string') {
		return { docs: [], error: 'CSV data must be a non-empty string' };
	}

	// Strip BOM (byte order mark) — trim() does not remove it
	let cleaned = csvData.trim();
	if (cleaned.charCodeAt(0) === 0xfeff) {
		cleaned = cleaned.slice(1);
	}

	const rows = parseCsv(cleaned);
	if (rows.length < 2) {
		return { docs: [], error: 'CSV must have a header row and at least one data row' };
	}

	const headers = rows[0];
	const docs: Record<string, unknown>[] = [];

	// Build a set of known field names for type coercion
	const fieldTypeMap = new Map<string, string>();
	for (const field of flattenDataFields(collection.fields)) {
		fieldTypeMap.set(field.name, field.type);
	}

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		const doc: Record<string, unknown> = {};

		for (let j = 0; j < headers.length && j < row.length; j++) {
			const header = headers[j].trim();
			const value = row[j];

			// Skip id, createdAt, updatedAt - let the system generate these
			if (header === 'id' || header === 'createdAt' || header === 'updatedAt') {
				continue;
			}

			if (value === '') {
				continue; // Skip empty values
			}

			// Type coercion based on field type
			const fieldType = fieldTypeMap.get(header);
			doc[header] = coerceCsvValue(value, fieldType);
		}

		docs.push(doc);
	}

	return { docs };
}

// ============================================
// Validation Types
// ============================================

export interface ImportValidationResult {
	/** Index of the document in the input array */
	index: number;
	/** Whether the document passed all validation checks */
	valid: boolean;
	/** Validation errors for this document */
	errors: { field: string; message: string }[];
	/** The document with coerced values */
	coerced: Record<string, unknown>;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate import documents against a collection schema without persisting.
 * Returns per-document validation results with coerced values and errors.
 */
export function validateImportDocs(
	docs: Record<string, unknown>[],
	collection: CollectionConfig,
): ImportValidationResult[] {
	const dataFields = flattenDataFields(collection.fields);
	const fieldMap = new Map<string, Field>();
	for (const field of dataFields) {
		fieldMap.set(field.name, field);
	}

	return docs.map((doc, index) => {
		const errors: { field: string; message: string }[] = [];
		const coerced: Record<string, unknown> = {};

		// Copy all values, coercing known fields
		for (const [key, value] of Object.entries(doc)) {
			const field = fieldMap.get(key);
			if (!field) {
				// Unknown field — pass through without error
				coerced[key] = value;
				continue;
			}

			const coercedValue = coerceAndValidateValue(value, field);
			if (coercedValue.error) {
				errors.push({ field: key, message: coercedValue.error });
			}
			coerced[key] = coercedValue.value;
		}

		// Check required fields
		for (const field of dataFields) {
			if (
				field.required &&
				(doc[field.name] === undefined || doc[field.name] === null || doc[field.name] === '')
			) {
				errors.push({ field: field.name, message: `"${field.name}" is required` });
			}
		}

		return {
			index,
			valid: errors.length === 0,
			errors,
			coerced,
		};
	});
}

/**
 * Coerce and validate a single value against its field type.
 * Returns the coerced value and an optional error message.
 */
function coerceAndValidateValue(value: unknown, field: Field): { value: unknown; error?: string } {
	if (value === undefined || value === null || value === '') {
		return { value };
	}

	switch (field.type) {
		case 'number': {
			if (typeof value === 'number' && Number.isFinite(value)) return { value };
			if (typeof value === 'number') {
				return { value, error: `"${field.name}" must be a finite number, got "${String(value)}"` };
			}
			const num = Number(value);
			if (Number.isNaN(num) || !Number.isFinite(num)) {
				return { value, error: `"${field.name}" must be a valid number, got "${String(value)}"` };
			}
			return { value: num };
		}
		case 'checkbox': {
			if (typeof value === 'boolean') return { value };
			const str = String(value).toLowerCase();
			return { value: str === 'true' || str === '1' };
		}
		case 'json':
		case 'array':
		case 'group':
		case 'blocks':
		case 'point': {
			if (typeof value === 'object') return { value };
			if (typeof value === 'string') {
				try {
					return { value: JSON.parse(value) };
				} catch {
					return { value, error: `"${field.name}" contains invalid JSON: "${value}"` };
				}
			}
			return { value };
		}
		default:
			return { value };
	}
}

/**
 * Strip the CSV injection escape prefix added during export.
 * `escapeCsvValue` prepends `'` to values starting with `=+\-@\t\r` — undo that on import.
 */
function stripCsvEscapePrefix(value: string): string {
	if (value.length > 1 && value[0] === "'" && /^[=+\-@\t\r]/.test(value[1])) {
		return value.substring(1);
	}
	return value;
}

/**
 * Coerce a CSV string value to the appropriate type based on field type.
 */
function coerceCsvValue(value: string, fieldType?: string): unknown {
	value = stripCsvEscapePrefix(value);
	switch (fieldType) {
		case 'number': {
			const num = Number(value);
			return Number.isNaN(num) || !Number.isFinite(num) ? value : num;
		}
		case 'checkbox':
			return value.toLowerCase() === 'true' || value === '1';
		case 'json':
		case 'array':
		case 'group':
		case 'blocks':
		case 'point':
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		default:
			return value;
	}
}

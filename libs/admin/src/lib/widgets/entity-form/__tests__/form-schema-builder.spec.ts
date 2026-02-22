import { describe, it, expect } from 'vitest';
import { applyCollectionSchema } from '../form-schema-builder';
import type { Field } from '@momentumcms/core';

/**
 * Tests for applyCollectionSchema.
 *
 * Note: Angular signal forms validators (required, minLength, etc.) do internal
 * path assertions that require a live form() context. We cannot mock them via
 * vi.mock because the package resolves through Angular's FESM bundle path.
 * Tests here cover the skip/branch logic that does NOT invoke validators.
 */

function mockField(type: string, overrides: Record<string, unknown> = {}): Field {
	const base: Record<string, unknown> = {
		name: overrides['name'] ?? 'testField',
		type,
		label: overrides['label'],
		required: overrides['required'] ?? false,
		...overrides,
	};

	return base as unknown as Field;
}

describe('applyCollectionSchema', () => {
	let schemaPathTree: Record<string, unknown>;

	beforeEach(() => {
		schemaPathTree = {
			title: { __brand: 'schemaPath_title' },
			email: { __brand: 'schemaPath_email' },
			count: { __brand: 'schemaPath_count' },
			bio: { __brand: 'schemaPath_bio' },
			status: { __brand: 'schemaPath_status' },
			items: { __brand: 'schemaPath_items' },
			content: { __brand: 'schemaPath_content' },
		};
	});

	it('should skip fields not present in schemaPathTree', () => {
		const fields = [mockField('text', { name: 'nonExistent', label: 'Ghost' })];

		// Should not throw
		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});

	it('should not throw for non-required fields with no type-specific validators', () => {
		const fields = [mockField('text', { name: 'title', label: 'Title', required: false })];

		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});

	it('should not throw for text fields without minLength/maxLength', () => {
		const fields = [mockField('text', { name: 'title', label: 'Title' })];

		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});

	it('should not throw for number fields without min/max', () => {
		const fields = [mockField('number', { name: 'count', label: 'Count' })];

		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});

	it('should not throw for array with empty fields list (no applyEach)', () => {
		const fields = [mockField('array', { name: 'items', label: 'Items', fields: [] })];

		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});

	it('should handle an empty fields array', () => {
		expect(() => applyCollectionSchema([], schemaPathTree)).not.toThrow();
	});

	it('should skip fields where schemaPathTree entry is falsy', () => {
		schemaPathTree['title'] = undefined;
		const fields = [mockField('text', { name: 'title', label: 'Title', required: true })];

		expect(() => applyCollectionSchema(fields, schemaPathTree)).not.toThrow();
	});
});

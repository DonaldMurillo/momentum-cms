/**
 * Extended tests for applyCollectionSchema.
 *
 * These tests mock @angular/forms/signals validators so we can capture
 * and invoke the callbacks passed to validate(), apply(), applyEach(), etc.
 * This lets us exercise the uncovered branches inside those callbacks.
 *
 * Uses vi.doMock + vi.resetModules to avoid contaminating other test files
 * in the same Vitest worker.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { Field } from '@momentumcms/core';

// ---- Captured callbacks ---------------------------------------------------
// Each mock captures the last callback passed to it so we can invoke it later.
let capturedRequired: Array<{ path: unknown; opts: unknown }> = [];
let capturedEmail: Array<{ path: unknown; opts: unknown }> = [];
let capturedMin: Array<{ path: unknown; val: unknown; opts: unknown }> = [];
let capturedMax: Array<{ path: unknown; val: unknown; opts: unknown }> = [];
let capturedMinLength: Array<{ path: unknown; val: unknown; opts: unknown }> = [];
let capturedMaxLength: Array<{ path: unknown; val: unknown; opts: unknown }> = [];
let capturedValidate: Array<{ path: unknown; fn: (ctx: { value: () => unknown }) => unknown }> = [];
let capturedApply: Array<{ path: unknown; fn: (tree: Record<string, unknown>) => void }> = [];
let capturedApplyEach: Array<{ path: unknown; fn: (tree: Record<string, unknown>) => void }> = [];

// Will be assigned dynamically after the mock is installed
let applyCollectionSchema: (
	fields: Field[],
	schemaPathTree: Record<string, unknown>,
	getFormData?: () => Record<string, unknown>,
) => void;

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

describe('applyCollectionSchema - extended coverage', () => {
	let schemaPathTree: Record<string, unknown>;

	beforeAll(async () => {
		vi.resetModules();
		vi.doMock('@angular/forms/signals', () => ({
			required: (path: unknown, opts: unknown) => {
				capturedRequired.push({ path, opts });
			},
			email: (path: unknown, opts: unknown) => {
				capturedEmail.push({ path, opts });
			},
			min: (path: unknown, val: unknown, opts: unknown) => {
				capturedMin.push({ path, val, opts });
			},
			max: (path: unknown, val: unknown, opts: unknown) => {
				capturedMax.push({ path, val, opts });
			},
			minLength: (path: unknown, val: unknown, opts: unknown) => {
				capturedMinLength.push({ path, val, opts });
			},
			maxLength: (path: unknown, val: unknown, opts: unknown) => {
				capturedMaxLength.push({ path, val, opts });
			},
			validate: (path: unknown, fn: (ctx: { value: () => unknown }) => unknown) => {
				capturedValidate.push({ path, fn });
			},
			apply: (path: unknown, fn: (tree: Record<string, unknown>) => void) => {
				capturedApply.push({ path, fn });
			},
			applyEach: (path: unknown, fn: (tree: Record<string, unknown>) => void) => {
				capturedApplyEach.push({ path, fn });
			},
		}));

		// Import AFTER the mock is installed
		const mod = await import('../form-schema-builder');
		applyCollectionSchema = mod.applyCollectionSchema;
	});

	afterAll(() => {
		vi.doUnmock('@angular/forms/signals');
		vi.resetModules();
	});

	beforeEach(() => {
		capturedRequired = [];
		capturedEmail = [];
		capturedMin = [];
		capturedMax = [];
		capturedMinLength = [];
		capturedMaxLength = [];
		capturedValidate = [];
		capturedApply = [];
		capturedApplyEach = [];

		schemaPathTree = {
			title: { __brand: 'schemaPath_title' },
			email: { __brand: 'schemaPath_email' },
			count: { __brand: 'schemaPath_count' },
			bio: { __brand: 'schemaPath_bio' },
			status: { __brand: 'schemaPath_status' },
			items: { __brand: 'schemaPath_items' },
			content: { __brand: 'schemaPath_content' },
			blocks: { __brand: 'schemaPath_blocks' },
			address: { __brand: 'schemaPath_address' },
			password: { __brand: 'schemaPath_password' },
			cover: { __brand: 'schemaPath_cover' },
			author: { __brand: 'schemaPath_author' },
			slug: { __brand: 'schemaPath_slug' },
			isPublished: { __brand: 'schemaPath_isPublished' },
			data: { __brand: 'schemaPath_data' },
		};
	});

	// -----------------------------------------------------------------------
	// required validator
	// -----------------------------------------------------------------------
	it('should add required validator when field.required is true', () => {
		const fields = [mockField('text', { name: 'title', label: 'Title', required: true })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedRequired).toHaveLength(1);
		expect(capturedRequired[0].path).toBe(schemaPathTree['title']);
		expect(capturedRequired[0].opts).toEqual({ message: 'Title is required' });
	});

	it('should auto-generate label from field name when label is missing', () => {
		const fields = [mockField('text', { name: 'title', required: true })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedRequired).toHaveLength(1);
		// humanizeFieldName('title') => 'Title'
		expect(capturedRequired[0].opts).toEqual({ message: 'Title is required' });
	});

	// -----------------------------------------------------------------------
	// text / textarea
	// -----------------------------------------------------------------------
	it('should add minLength validator for text field', () => {
		const fields = [mockField('text', { name: 'title', label: 'Title', minLength: 3 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMinLength).toHaveLength(1);
		expect(capturedMinLength[0].val).toBe(3);
	});

	it('should add maxLength validator for text field', () => {
		const fields = [mockField('text', { name: 'title', label: 'Title', maxLength: 100 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMaxLength).toHaveLength(1);
		expect(capturedMaxLength[0].val).toBe(100);
	});

	it('should add minLength and maxLength for textarea field', () => {
		const fields = [
			mockField('textarea', { name: 'bio', label: 'Bio', minLength: 10, maxLength: 500 }),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMinLength).toHaveLength(1);
		expect(capturedMaxLength).toHaveLength(1);
	});

	// -----------------------------------------------------------------------
	// password
	// -----------------------------------------------------------------------
	it('should add minLength validator for password field', () => {
		const fields = [mockField('password', { name: 'password', label: 'Password', minLength: 8 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMinLength).toHaveLength(1);
		expect(capturedMinLength[0].val).toBe(8);
	});

	it('should skip minLength for password without it', () => {
		const fields = [mockField('password', { name: 'password', label: 'Password' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMinLength).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// number
	// -----------------------------------------------------------------------
	it('should add min validator for number field', () => {
		const fields = [mockField('number', { name: 'count', label: 'Count', min: 0 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMin).toHaveLength(1);
		expect(capturedMin[0].val).toBe(0);
	});

	it('should add max validator for number field', () => {
		const fields = [mockField('number', { name: 'count', label: 'Count', max: 100 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMax).toHaveLength(1);
		expect(capturedMax[0].val).toBe(100);
	});

	it('should add both min and max for number field', () => {
		const fields = [mockField('number', { name: 'count', label: 'Count', min: 1, max: 50 })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedMin).toHaveLength(1);
		expect(capturedMax).toHaveLength(1);
	});

	// -----------------------------------------------------------------------
	// email
	// -----------------------------------------------------------------------
	it('should add email validator for email field', () => {
		const fields = [mockField('email', { name: 'email', label: 'Email' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedEmail).toHaveLength(1);
		expect(capturedEmail[0].opts).toEqual({ message: 'Email must be a valid email address' });
	});

	// -----------------------------------------------------------------------
	// select - validate callback
	// -----------------------------------------------------------------------
	it('should add select option validator', () => {
		const fields = [
			mockField('select', {
				name: 'status',
				label: 'Status',
				options: [
					{ label: 'Active', value: 'active' },
					{ label: 'Inactive', value: 'inactive' },
				],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('select validator should return null for empty/null/undefined values', () => {
		const fields = [
			mockField('select', {
				name: 'status',
				label: 'Status',
				options: [{ label: 'Active', value: 'active' }],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const selectValidator = capturedValidate[0].fn;
		expect(selectValidator({ value: () => '' })).toBeNull();
		expect(selectValidator({ value: () => null })).toBeNull();
		expect(selectValidator({ value: () => undefined })).toBeNull();
	});

	it('select validator should return null for valid option', () => {
		const fields = [
			mockField('select', {
				name: 'status',
				label: 'Status',
				options: [
					{ label: 'Active', value: 'active' },
					{ label: 'Inactive', value: 'inactive' },
				],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const selectValidator = capturedValidate[0].fn;
		expect(selectValidator({ value: () => 'active' })).toBeNull();
	});

	it('select validator should return error for invalid option', () => {
		const fields = [
			mockField('select', {
				name: 'status',
				label: 'Status',
				options: [
					{ label: 'Active', value: 'active' },
					{ label: 'Inactive', value: 'inactive' },
				],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const selectValidator = capturedValidate[0].fn;
		const result = selectValidator({ value: () => 'invalid' });
		expect(result).toEqual({
			kind: 'invalidOption',
			message: 'Status must be one of the available options',
		});
	});

	// -----------------------------------------------------------------------
	// group - apply callback (L116-124)
	// -----------------------------------------------------------------------
	it('should call apply for group fields', () => {
		const fields = [
			mockField('group', {
				name: 'address',
				label: 'Address',
				fields: [mockField('text', { name: 'street', label: 'Street' })],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedApply).toHaveLength(1);
		expect(capturedApply[0].path).toBe(schemaPathTree['address']);
	});

	it('group apply callback should recursively apply schema to sub-fields', () => {
		const fields = [
			mockField('group', {
				name: 'address',
				label: 'Address',
				fields: [mockField('text', { name: 'street', label: 'Street', required: true })],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		// Invoke the captured apply callback with a sub-tree
		const applyCallback = capturedApply[0].fn;
		const subTree = { street: { __brand: 'schemaPath_street' } };

		// Clear captured arrays to isolate recursive call results
		capturedRequired = [];
		applyCallback(subTree);

		// The recursive call should have added a required validator for 'street'
		expect(capturedRequired).toHaveLength(1);
		expect(capturedRequired[0].path).toBe(subTree['street']);
	});

	// -----------------------------------------------------------------------
	// array - minRows/maxRows/applyEach (L126-167)
	// -----------------------------------------------------------------------
	it('should add minRows validator for array field', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				minRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		// minRows uses validate()
		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('array minRows validator should return null when not an array', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				minRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		expect(minRowsValidator({ value: () => 'not-an-array' })).toBeNull();
	});

	it('array minRows validator should return error when too few rows', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				minRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		const result = minRowsValidator({ value: () => [1] });
		expect(result).toEqual({
			kind: 'minRows',
			message: 'Items must have at least 2 rows',
		});
	});

	it('array minRows validator should return null when enough rows', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				minRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		expect(minRowsValidator({ value: () => [1, 2, 3] })).toBeNull();
	});

	it('array minRows=1 should use singular "row"', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				minRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		const result = minRowsValidator({ value: () => [] });
		expect(result).toEqual({
			kind: 'minRows',
			message: 'Items must have at least 1 row',
		});
	});

	it('should add maxRows validator for array field', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				maxRows: 5,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('array maxRows validator should return null when not an array', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				maxRows: 3,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		expect(maxRowsValidator({ value: () => 'not-an-array' })).toBeNull();
	});

	it('array maxRows validator should return error when too many rows', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				maxRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		const result = maxRowsValidator({ value: () => [1, 2, 3] });
		expect(result).toEqual({
			kind: 'maxRows',
			message: 'Items must have no more than 2 rows',
		});
	});

	it('array maxRows validator should return null when within limit', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				maxRows: 5,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		expect(maxRowsValidator({ value: () => [1, 2] })).toBeNull();
	});

	it('array maxRows=1 should use singular "row"', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
				maxRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		const result = maxRowsValidator({ value: () => [1, 2] });
		expect(result).toEqual({
			kind: 'maxRows',
			message: 'Items must have no more than 1 row',
		});
	});

	it('should call applyEach for array field with sub-fields', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [mockField('text', { name: 'title', label: 'Title' })],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedApplyEach).toHaveLength(1);
		expect(capturedApplyEach[0].path).toBe(schemaPathTree['items']);
	});

	it('array applyEach callback should recursively apply schema to item fields', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [mockField('text', { name: 'title', label: 'Title', required: true })],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const applyEachCallback = capturedApplyEach[0].fn;
		const itemTree = { title: { __brand: 'schemaPath_item_title' } };

		capturedRequired = [];
		applyEachCallback(itemTree);

		expect(capturedRequired).toHaveLength(1);
		expect(capturedRequired[0].path).toBe(itemTree['title']);
	});

	it('should not call applyEach when array fields list is empty', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedApplyEach).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// blocks - minRows/maxRows (L171-201)
	// -----------------------------------------------------------------------
	it('should add minRows validator for blocks field', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('blocks minRows validator should return null when not an array', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		expect(minRowsValidator({ value: () => null })).toBeNull();
	});

	it('blocks minRows validator should return error when too few blocks', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		const result = minRowsValidator({ value: () => [1] });
		expect(result).toEqual({
			kind: 'minRows',
			message: 'Blocks must have at least 2 blocks',
		});
	});

	it('blocks minRows validator should return null when enough blocks', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		expect(minRowsValidator({ value: () => [1, 2] })).toBeNull();
	});

	it('blocks minRows=1 should use singular "block"', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const minRowsValidator = capturedValidate[0].fn;
		const result = minRowsValidator({ value: () => [] });
		expect(result).toEqual({
			kind: 'minRows',
			message: 'Blocks must have at least 1 block',
		});
	});

	it('should add maxRows validator for blocks field', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				maxRows: 10,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('blocks maxRows validator should return null when not an array', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				maxRows: 3,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		expect(maxRowsValidator({ value: () => undefined })).toBeNull();
	});

	it('blocks maxRows validator should return error when too many blocks', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				maxRows: 2,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		const result = maxRowsValidator({ value: () => [1, 2, 3] });
		expect(result).toEqual({
			kind: 'maxRows',
			message: 'Blocks must have no more than 2 blocks',
		});
	});

	it('blocks maxRows validator should return null when within limit', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				maxRows: 5,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		expect(maxRowsValidator({ value: () => [1] })).toBeNull();
	});

	it('blocks maxRows=1 should use singular "block"', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				maxRows: 1,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const maxRowsValidator = capturedValidate[0].fn;
		const result = maxRowsValidator({ value: () => [1, 2] });
		expect(result).toEqual({
			kind: 'maxRows',
			message: 'Blocks must have no more than 1 block',
		});
	});

	// -----------------------------------------------------------------------
	// default case — other field types (L203-207)
	// -----------------------------------------------------------------------
	it('should handle checkbox field type (default case, no extra validators)', () => {
		const fields = [mockField('checkbox', { name: 'isPublished', label: 'Published' })];
		applyCollectionSchema(fields, schemaPathTree);

		// No type-specific validators should be added
		expect(capturedMinLength).toHaveLength(0);
		expect(capturedMaxLength).toHaveLength(0);
		expect(capturedMin).toHaveLength(0);
		expect(capturedMax).toHaveLength(0);
		expect(capturedEmail).toHaveLength(0);
		expect(capturedApply).toHaveLength(0);
		expect(capturedApplyEach).toHaveLength(0);
		// No validate for the type itself (only if custom validate is present)
		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle date field type (default case)', () => {
		const fields = [mockField('date', { name: 'data', label: 'Date' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle upload field type (default case)', () => {
		const fields = [mockField('upload', { name: 'cover', label: 'Cover', relationTo: 'media' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle relationship field type (default case)', () => {
		const fields = [
			mockField('relationship', {
				name: 'author',
				label: 'Author',
				collection: () => ({}),
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle slug field type (default case)', () => {
		const fields = [mockField('slug', { name: 'slug', label: 'Slug', from: 'title' })];
		schemaPathTree['slug'] = { __brand: 'schemaPath_slug' };
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle richText field type (default case)', () => {
		const fields = [mockField('richText', { name: 'content', label: 'Content' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	it('should handle json field type (default case)', () => {
		const fields = [mockField('json', { name: 'data', label: 'Data' })];
		applyCollectionSchema(fields, schemaPathTree);

		expect(capturedValidate).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// custom validate function (L210-230)
	// -----------------------------------------------------------------------
	it('should register custom validate function when field.validate exists', () => {
		const customValidator = vi.fn().mockReturnValue(true);
		const fields = [
			mockField('text', {
				name: 'title',
				label: 'Title',
				validate: customValidator,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		// One validate call for custom validator
		expect(capturedValidate.length).toBeGreaterThanOrEqual(1);
	});

	it('custom validator should call field.validate with value and data', () => {
		const customValidator = vi.fn().mockReturnValue(true);
		const getFormData = vi.fn().mockReturnValue({ title: 'Hello' });
		const fields = [
			mockField('text', {
				name: 'title',
				label: 'Title',
				validate: customValidator,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree, getFormData);

		// The last captured validate fn is the custom one
		const customValidateFn = capturedValidate[capturedValidate.length - 1].fn;
		const result = customValidateFn({ value: () => 'test value' });

		expect(customValidator).toHaveBeenCalledWith('test value', {
			data: { title: 'Hello' },
			req: {},
		});
		// true return => null (no error)
		expect(result).toBeNull();
	});

	it('custom validator should return error object when validate returns a string', () => {
		const customValidator = vi.fn().mockReturnValue('Title is too short');
		const fields = [
			mockField('text', {
				name: 'title',
				label: 'Title',
				validate: customValidator,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const customValidateFn = capturedValidate[capturedValidate.length - 1].fn;
		const result = customValidateFn({ value: () => 'x' });

		expect(result).toEqual({
			kind: 'custom',
			message: 'Title is too short',
		});
	});

	it('custom validator should warn and return null for async validators (Promise)', () => {
		const asyncValidator = vi.fn().mockReturnValue(Promise.resolve(true));
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
			/* noop */
		});
		const fields = [
			mockField('text', {
				name: 'title',
				label: 'Title',
				validate: asyncValidator,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		const customValidateFn = capturedValidate[capturedValidate.length - 1].fn;
		const result = customValidateFn({ value: () => 'val' });

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Custom validator on field "title" returned a Promise'),
		);
		expect(result).toBeNull();
		warnSpy.mockRestore();
	});

	it('custom validator should use empty object for data when getFormData is not provided', () => {
		const customValidator = vi.fn().mockReturnValue(true);
		const fields = [
			mockField('text', {
				name: 'title',
				label: 'Title',
				validate: customValidator,
			}),
		];
		// No getFormData argument
		applyCollectionSchema(fields, schemaPathTree);

		const customValidateFn = capturedValidate[capturedValidate.length - 1].fn;
		customValidateFn({ value: () => 'val' });

		expect(customValidator).toHaveBeenCalledWith('val', {
			data: {},
			req: {},
		});
	});

	// -----------------------------------------------------------------------
	// combined tests: array with both minRows, maxRows and sub-fields
	// -----------------------------------------------------------------------
	it('should register minRows, maxRows, and applyEach for a fully configured array', () => {
		const fields = [
			mockField('array', {
				name: 'items',
				label: 'Items',
				fields: [mockField('text', { name: 'title', label: 'Title' })],
				minRows: 1,
				maxRows: 10,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		// 2 validate calls for minRows + maxRows
		expect(capturedValidate).toHaveLength(2);
		// 1 applyEach for sub-fields
		expect(capturedApplyEach).toHaveLength(1);
	});

	// -----------------------------------------------------------------------
	// blocks with both minRows and maxRows
	// -----------------------------------------------------------------------
	it('should register both minRows and maxRows validators for blocks', () => {
		const fields = [
			mockField('blocks', {
				name: 'blocks',
				label: 'Content Blocks',
				blocks: [{ slug: 'text', fields: [] }],
				minRows: 1,
				maxRows: 20,
			}),
		];
		applyCollectionSchema(fields, schemaPathTree);

		// 2 validate calls: one for minRows, one for maxRows
		expect(capturedValidate).toHaveLength(2);
	});

	// -----------------------------------------------------------------------
	// group with getFormData passthrough
	// -----------------------------------------------------------------------
	it('group apply callback should pass getFormData to recursive call', () => {
		const getFormData = vi.fn().mockReturnValue({ address: { street: '123 Main' } });
		const customValidator = vi.fn().mockReturnValue(true);
		const fields = [
			mockField('group', {
				name: 'address',
				label: 'Address',
				fields: [
					mockField('text', {
						name: 'street',
						label: 'Street',
						validate: customValidator,
					}),
				],
			}),
		];
		applyCollectionSchema(fields, schemaPathTree, getFormData);

		// Invoke the group apply callback
		const applyCallback = capturedApply[0].fn;
		const subTree = { street: { __brand: 'schemaPath_street' } };

		capturedValidate = [];
		applyCallback(subTree);

		// Now invoke the custom validator inside the group
		expect(capturedValidate).toHaveLength(1);
		capturedValidate[0].fn({ value: () => 'test' });

		// getFormData should be passed through to the recursive call
		expect(getFormData).toHaveBeenCalled();
		expect(customValidator).toHaveBeenCalledWith('test', {
			data: { address: { street: '123 Main' } },
			req: {},
		});
	});
});

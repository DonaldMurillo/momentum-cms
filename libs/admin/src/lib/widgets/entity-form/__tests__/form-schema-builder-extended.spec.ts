/**
 * Extended tests for applyCollectionSchema using real Angular Signal Forms.
 *
 * Instead of mocking @angular/forms/signals (blocked by @nx/angular:unit-test),
 * these tests create real Signal Forms via form(), apply validators with
 * applyCollectionSchema inside a schema callback, and verify behavior via submit().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import type { FieldTree } from '@angular/forms/signals';
import type { Field } from '@momentumcms/core';
import { applyCollectionSchema } from '../form-schema-builder';

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

/**
 * Create a Signal Form with validators applied via applyCollectionSchema.
 * Uses the schema callback pattern: form(model, schemaFn, { injector }).
 */
function createTestForm(
	model: Record<string, unknown>,
	fields: Field[],
	injector: Injector,
	getFormData?: () => Record<string, unknown>,
): FieldTree<Record<string, unknown>> {
	const modelSignal = signal(model);
	return form(
		modelSignal,
		(tree: Record<string, unknown>) => {
			applyCollectionSchema(fields, tree, getFormData);
		},
		{ injector },
	);
}

/**
 * Use submit() to test form validity.
 * Returns true if the form is valid (action was invoked), false if invalid.
 */
async function isFormValid(formTree: FieldTree<Record<string, unknown>>): Promise<boolean> {
	let actionCalled = false;
	await submit(formTree, {
		action: async () => {
			actionCalled = true;
		},
	});
	return actionCalled;
}

describe('applyCollectionSchema - extended coverage', () => {
	let injector: Injector;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		injector = TestBed.inject(Injector);
	});

	// -----------------------------------------------------------------------
	// required validator
	// -----------------------------------------------------------------------
	it('should add required validator when field.required is true', async () => {
		const formTree = createTestForm(
			{ title: '' },
			[mockField('text', { name: 'title', label: 'Title', required: true })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should pass required when field has a value', async () => {
		const formTree = createTestForm(
			{ title: 'Hello' },
			[mockField('text', { name: 'title', label: 'Title', required: true })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should auto-generate label from field name when label is missing', async () => {
		const formTree = createTestForm(
			{ title: '' },
			[mockField('text', { name: 'title', required: true })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	// -----------------------------------------------------------------------
	// text / textarea
	// -----------------------------------------------------------------------
	it('should add minLength validator for text field', async () => {
		const formTree = createTestForm(
			{ title: 'ab' },
			[mockField('text', { name: 'title', label: 'Title', minLength: 3 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept text at exact minLength', async () => {
		const formTree = createTestForm(
			{ title: 'abc' },
			[mockField('text', { name: 'title', label: 'Title', minLength: 3 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add maxLength validator for text field', async () => {
		const formTree = createTestForm(
			{ title: 'too long text value' },
			[mockField('text', { name: 'title', label: 'Title', maxLength: 5 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept text at exact maxLength', async () => {
		const formTree = createTestForm(
			{ title: 'abcde' },
			[mockField('text', { name: 'title', label: 'Title', maxLength: 5 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add minLength and maxLength for textarea field', async () => {
		const formTree = createTestForm(
			{ bio: 'hi' },
			[mockField('textarea', { name: 'bio', label: 'Bio', minLength: 10, maxLength: 500 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	// -----------------------------------------------------------------------
	// password
	// -----------------------------------------------------------------------
	it('should add minLength validator for password field', async () => {
		const formTree = createTestForm(
			{ pw: 'short' },
			[mockField('password', { name: 'pw', label: 'Password', minLength: 8 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept password meeting minLength', async () => {
		const formTree = createTestForm(
			{ pw: 'longpassword' },
			[mockField('password', { name: 'pw', label: 'Password', minLength: 8 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should skip minLength for password without it', async () => {
		const formTree = createTestForm(
			{ pw: 'x' },
			[mockField('password', { name: 'pw', label: 'Password' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// number
	// -----------------------------------------------------------------------
	it('should add min validator for number field', async () => {
		const formTree = createTestForm(
			{ count: -1 },
			[mockField('number', { name: 'count', label: 'Count', min: 0 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept number at min boundary', async () => {
		const formTree = createTestForm(
			{ count: 0 },
			[mockField('number', { name: 'count', label: 'Count', min: 0 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add max validator for number field', async () => {
		const formTree = createTestForm(
			{ count: 200 },
			[mockField('number', { name: 'count', label: 'Count', max: 100 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept number at max boundary', async () => {
		const formTree = createTestForm(
			{ count: 100 },
			[mockField('number', { name: 'count', label: 'Count', max: 100 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add both min and max for number field', async () => {
		const formTree = createTestForm(
			{ count: 25 },
			[mockField('number', { name: 'count', label: 'Count', min: 1, max: 50 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should reject number above max with both bounds', async () => {
		const formTree = createTestForm(
			{ count: 51 },
			[mockField('number', { name: 'count', label: 'Count', min: 1, max: 50 })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	// -----------------------------------------------------------------------
	// email
	// -----------------------------------------------------------------------
	it('should add email validator for email field', async () => {
		const formTree = createTestForm(
			{ mail: 'not-an-email' },
			[mockField('email', { name: 'mail', label: 'Email' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should accept valid email address', async () => {
		const formTree = createTestForm(
			{ mail: 'user@example.com' },
			[mockField('email', { name: 'mail', label: 'Email' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// select - validate callback
	// -----------------------------------------------------------------------
	it('should add select option validator', async () => {
		const formTree = createTestForm(
			{ status: 'invalid' },
			[
				mockField('select', {
					name: 'status',
					label: 'Status',
					options: [
						{ label: 'Active', value: 'active' },
						{ label: 'Inactive', value: 'inactive' },
					],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('select validator should accept empty values', async () => {
		const formTree = createTestForm(
			{ status: '' },
			[
				mockField('select', {
					name: 'status',
					label: 'Status',
					options: [{ label: 'Active', value: 'active' }],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('select validator should accept valid option', async () => {
		const formTree = createTestForm(
			{ status: 'active' },
			[
				mockField('select', {
					name: 'status',
					label: 'Status',
					options: [
						{ label: 'Active', value: 'active' },
						{ label: 'Inactive', value: 'inactive' },
					],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('select validator should reject invalid option', async () => {
		const formTree = createTestForm(
			{ status: 'invalid-val' },
			[
				mockField('select', {
					name: 'status',
					label: 'Status',
					options: [
						{ label: 'Active', value: 'active' },
						{ label: 'Inactive', value: 'inactive' },
					],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	// -----------------------------------------------------------------------
	// group - apply callback
	// -----------------------------------------------------------------------
	it('should apply validators recursively for group fields', async () => {
		const formTree = createTestForm(
			{ address: { street: '' } },
			[
				mockField('group', {
					name: 'address',
					label: 'Address',
					fields: [mockField('text', { name: 'street', label: 'Street', required: true })],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('group should be valid when all sub-fields pass', async () => {
		const formTree = createTestForm(
			{ address: { street: '123 Main St' } },
			[
				mockField('group', {
					name: 'address',
					label: 'Address',
					fields: [mockField('text', { name: 'street', label: 'Street', required: true })],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// array - minRows/maxRows/applyEach
	// -----------------------------------------------------------------------
	it('should add minRows validator for array field', async () => {
		const formTree = createTestForm(
			{ items: [] as Record<string, unknown>[] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [],
					minRows: 1,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('array minRows validator should pass when not an array', async () => {
		const formTree = createTestForm(
			{ items: 'not-array' as unknown },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [],
					minRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('array minRows validator should fail when too few rows', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'one' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title' })],
					minRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('array minRows validator should pass when enough rows', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title' })],
					minRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add maxRows validator for array field', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title' })],
					maxRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('array maxRows validator should pass when not an array', async () => {
		const formTree = createTestForm(
			{ items: 'not-array' as unknown },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [],
					maxRows: 3,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('array maxRows validator should fail when too many rows', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title' })],
					maxRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('array maxRows validator should pass when within limit', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'a' }, { title: 'b' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title' })],
					maxRows: 5,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should apply validators via applyEach for array sub-fields', async () => {
		const formTree = createTestForm(
			{ items: [{ title: '' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title', label: 'Title', required: true })],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('array applyEach should pass when sub-fields are valid', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'Hello' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title', label: 'Title', required: true })],
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should not crash when array fields list is empty', () => {
		expect(() =>
			createTestForm(
				{ items: [{}] },
				[mockField('array', { name: 'items', label: 'Items', fields: [] })],
				injector,
			),
		).not.toThrow();
	});

	// -----------------------------------------------------------------------
	// blocks - minRows/maxRows
	// -----------------------------------------------------------------------
	it('should add minRows validator for blocks field', async () => {
		const formTree = createTestForm(
			{ blocks: [] as unknown[] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					minRows: 1,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('blocks minRows validator should pass when not an array', async () => {
		const formTree = createTestForm(
			{ blocks: null as unknown },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					minRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('blocks minRows validator should fail when too few', async () => {
		const formTree = createTestForm(
			{ blocks: [{ blockType: 'text' }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					minRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('blocks minRows validator should pass when enough', async () => {
		const formTree = createTestForm(
			{ blocks: [{ blockType: 'text' }, { blockType: 'text' }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					minRows: 1,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should add maxRows validator for blocks field', async () => {
		const formTree = createTestForm(
			{ blocks: [{ t: 1 }, { t: 2 }, { t: 3 }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					maxRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('blocks maxRows validator should pass when not an array', async () => {
		const formTree = createTestForm(
			{ blocks: undefined as unknown },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					maxRows: 3,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('blocks maxRows validator should fail when too many', async () => {
		const formTree = createTestForm(
			{ blocks: [{ t: 1 }, { t: 2 }, { t: 3 }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					maxRows: 2,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('blocks maxRows validator should pass when within limit', async () => {
		const formTree = createTestForm(
			{ blocks: [{ blockType: 'text' }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					maxRows: 5,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// default case — other field types
	// -----------------------------------------------------------------------
	it('should handle checkbox field type (no extra validators)', async () => {
		const formTree = createTestForm(
			{ isPublished: false },
			[mockField('checkbox', { name: 'isPublished', label: 'Published' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle date field type', async () => {
		const formTree = createTestForm(
			{ dateVal: '2024-01-01' },
			[mockField('date', { name: 'dateVal', label: 'Date' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle upload field type', async () => {
		const formTree = createTestForm(
			{ cover: '' },
			[mockField('upload', { name: 'cover', label: 'Cover', relationTo: 'media' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle relationship field type', async () => {
		const formTree = createTestForm(
			{ author: '' },
			[mockField('relationship', { name: 'author', label: 'Author', collection: () => ({}) })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle slug field type', async () => {
		const formTree = createTestForm(
			{ slugVal: 'my-slug' },
			[mockField('slug', { name: 'slugVal', label: 'Slug', from: 'title' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle richText field type', async () => {
		const formTree = createTestForm(
			{ content: '<p>Hello</p>' },
			[mockField('richText', { name: 'content', label: 'Content' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle json field type', async () => {
		const formTree = createTestForm(
			{ jsonData: '{}' },
			[mockField('json', { name: 'jsonData', label: 'Data' })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// custom validate function
	// -----------------------------------------------------------------------
	it('should register custom validate function', async () => {
		const customValidator = vi.fn().mockReturnValue('Too short');
		const formTree = createTestForm(
			{ title: 'x' },
			[mockField('text', { name: 'title', label: 'Title', validate: customValidator })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('custom validator should call field.validate with value and data', async () => {
		const customValidator = vi.fn().mockReturnValue(true);
		const getFormData = vi.fn().mockReturnValue({ title: 'Hello' });
		const formTree = createTestForm(
			{ title: 'test value' },
			[mockField('text', { name: 'title', label: 'Title', validate: customValidator })],
			injector,
			getFormData,
		);

		await isFormValid(formTree);

		expect(customValidator).toHaveBeenCalledWith('test value', {
			data: { title: 'Hello' },
			req: {},
		});
	});

	it('custom validator should fail when validate returns a string', async () => {
		const formTree = createTestForm(
			{ title: 'x' },
			[
				mockField('text', {
					name: 'title',
					label: 'Title',
					validate: () => 'Title is too short',
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('custom validator should pass when validate returns true', async () => {
		const formTree = createTestForm(
			{ title: 'valid' },
			[mockField('text', { name: 'title', label: 'Title', validate: () => true })],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('custom validator should warn and pass for async validators (Promise)', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
			/* noop */
		});
		const formTree = createTestForm(
			{ title: 'val' },
			[
				mockField('text', {
					name: 'title',
					label: 'Title',
					validate: () => Promise.resolve(true),
				}),
			],
			injector,
		);

		expect(await isFormValid(formTree)).toBe(true);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Custom validator on field "title" returned a Promise'),
		);
		warnSpy.mockRestore();
	});

	it('custom validator should use empty object for data when getFormData is not provided', async () => {
		const customValidator = vi.fn().mockReturnValue(true);
		const formTree = createTestForm(
			{ title: 'val' },
			[mockField('text', { name: 'title', label: 'Title', validate: customValidator })],
			injector,
		);

		await isFormValid(formTree);

		expect(customValidator).toHaveBeenCalledWith('val', {
			data: {},
			req: {},
		});
	});

	// -----------------------------------------------------------------------
	// combined tests
	// -----------------------------------------------------------------------
	it('should validate both minRows and sub-field required for array', async () => {
		const formTree = createTestForm(
			{ items: [] as Record<string, unknown>[] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title', label: 'Title' })],
					minRows: 1,
					maxRows: 10,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should validate array within bounds with valid sub-fields', async () => {
		const formTree = createTestForm(
			{ items: [{ title: 'Hello' }] },
			[
				mockField('array', {
					name: 'items',
					label: 'Items',
					fields: [mockField('text', { name: 'title', label: 'Title' })],
					minRows: 1,
					maxRows: 10,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should validate blocks within both min and max bounds', async () => {
		const formTree = createTestForm(
			{ blocks: [{ blockType: 'text' }, { blockType: 'text' }] },
			[
				mockField('blocks', {
					name: 'blocks',
					label: 'Content Blocks',
					blocks: [{ slug: 'text', fields: [] }],
					minRows: 1,
					maxRows: 20,
				}),
			],
			injector,
		);
		expect(await isFormValid(formTree)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// group with getFormData passthrough
	// -----------------------------------------------------------------------
	it('group apply callback should pass getFormData to recursive call', async () => {
		const getFormData = vi.fn().mockReturnValue({ address: { street: '123 Main' } });
		const customValidator = vi.fn().mockReturnValue(true);
		const formTree = createTestForm(
			{ address: { street: 'test' } },
			[
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
			],
			injector,
			getFormData,
		);

		await isFormValid(formTree);

		expect(getFormData).toHaveBeenCalled();
		expect(customValidator).toHaveBeenCalledWith('test', {
			data: { address: { street: '123 Main' } },
			req: {},
		});
	});
});

import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { submit, type FieldTree } from '@angular/forms/signals';
import {
	buildInitialModel,
	createFormFromSchema,
	applyFormFieldValidators,
} from './schema-to-signal-form';
import type { FormSchema, FormFieldConfig } from '../types/form-schema.types';

describe('buildInitialModel', () => {
	it('should create model with default values from schema', () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{ name: 'name', type: 'text', defaultValue: 'John' },
				{ name: 'age', type: 'number', defaultValue: 25 },
			],
		};
		const model = buildInitialModel(schema);
		expect(model).toEqual({ name: 'John', age: 25 });
	});

	it('should use type defaults when no defaultValue specified', () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{ name: 'name', type: 'text' },
				{ name: 'age', type: 'number' },
				{ name: 'agree', type: 'checkbox' },
				{ name: 'email', type: 'email' },
				{ name: 'bio', type: 'textarea' },
				{ name: 'date', type: 'date' },
				{ name: 'hidden', type: 'hidden' },
			],
		};
		const model = buildInitialModel(schema);
		expect(model['name']).toBe('');
		expect(model['age']).toBeNull();
		expect(model['agree']).toBe(false);
		expect(model['email']).toBe('');
		expect(model['bio']).toBe('');
		expect(model['date']).toBe('');
		expect(model['hidden']).toBe('');
	});
});

describe('createFormFromSchema', () => {
	let injector: Injector;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		injector = TestBed.inject(Injector);
	});

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

	it('should create a form with injector', () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'name', type: 'text' }],
		};
		const { model, formTree } = createFormFromSchema(schema, { injector });
		expect(formTree).toBeDefined();
		expect(model()).toEqual({ name: '' });
	});

	it('should apply required validator (form invalid when required field is empty)', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'name', type: 'text', required: true, label: 'Full Name' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should be valid when required field has a value', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'name', type: 'text', required: true, defaultValue: 'John' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should apply email validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'email', type: 'email', defaultValue: 'not-an-email' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should apply number min validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'age', type: 'number', min: 18, defaultValue: 10 }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should apply number max validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'age', type: 'number', max: 100, defaultValue: 150 }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should apply text minLength validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'bio', type: 'text', minLength: 5, defaultValue: 'Hi' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should apply text maxLength validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'bio', type: 'text', maxLength: 3, defaultValue: 'Hello World' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should apply select option validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'color',
					type: 'select',
					options: [
						{ label: 'Red', value: 'red' },
						{ label: 'Blue', value: 'blue' },
					],
					defaultValue: 'green',
				},
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should be valid when all constraints are satisfied', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{ name: 'name', type: 'text', required: true, defaultValue: 'John' },
				{ name: 'email', type: 'email', defaultValue: 'john@example.com' },
				{ name: 'age', type: 'number', min: 0, max: 200, defaultValue: 30 },
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should apply pattern validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'zip',
					type: 'text',
					validation: { pattern: '^\\d{5}$', patternMessage: 'Must be 5 digits' },
					defaultValue: 'abc',
				},
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should not crash when a field has an invalid regex pattern', () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'code',
					type: 'text',
					validation: { pattern: '[invalid(' },
					defaultValue: 'test',
				},
			],
		};
		expect(() => createFormFromSchema(schema, { injector })).not.toThrow();
	});

	it('should create a valid form when regex is invalid (pattern validator skipped)', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'code',
					type: 'text',
					validation: { pattern: '[invalid(' },
					defaultValue: 'anything',
				},
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should not hang on a ReDoS-vulnerable regex pattern', () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'test',
					type: 'text',
					validation: { pattern: '(a+)+$' },
					defaultValue: 'safe',
				},
			],
		};
		const start = Date.now();
		expect(() => createFormFromSchema(schema, { injector })).not.toThrow();
		expect(Date.now() - start).toBeLessThan(1000);
	});

	it('should apply radio option validator', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'size',
					type: 'radio',
					options: [
						{ label: 'S', value: 'small' },
						{ label: 'L', value: 'large' },
					],
					defaultValue: 'medium',
				},
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(false);
	});

	it('should allow valid radio selection', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [
				{
					name: 'size',
					type: 'radio',
					options: [
						{ label: 'S', value: 'small' },
						{ label: 'L', value: 'large' },
					],
					defaultValue: 'small',
				},
			],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle checkbox with default false (no required)', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'agree', type: 'checkbox' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle date field', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'birthday', type: 'date', defaultValue: '2000-01-01' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});

	it('should handle hidden field', async () => {
		const schema: FormSchema = {
			id: 'test',
			fields: [{ name: 'token', type: 'hidden', defaultValue: 'abc123' }],
		};
		const { formTree } = createFormFromSchema(schema, { injector });
		expect(await isFormValid(formTree)).toBe(true);
	});
});

describe('applyFormFieldValidators', () => {
	it('should skip fields not present in schema path tree', () => {
		const fields: FormFieldConfig[] = [{ name: 'missing', type: 'text', required: true }];
		expect(() => applyFormFieldValidators(fields, {})).not.toThrow();
	});
});

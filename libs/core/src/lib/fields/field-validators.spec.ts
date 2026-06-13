import { describe, it, expect } from 'vitest';
import { validateFieldConstraints } from './field-validators';
import type { Field } from './field.types';

describe('validateFieldConstraints', () => {
	describe('null/undefined values', () => {
		it('should return empty errors for null value', () => {
			const field: Field = { name: 'title', type: 'text', minLength: 5 };
			expect(validateFieldConstraints(field, null)).toEqual([]);
		});

		it('should return empty errors for undefined value', () => {
			const field: Field = { name: 'title', type: 'text', minLength: 5 };
			expect(validateFieldConstraints(field, undefined)).toEqual([]);
		});
	});

	describe('text field', () => {
		it('should skip validation when value is not a string (number)', () => {
			const field: Field = { name: 'title', type: 'text', minLength: 5 };
			expect(validateFieldConstraints(field, 123)).toEqual([]);
		});

		it('should validate minLength', () => {
			const field: Field = { name: 'title', type: 'text', minLength: 5 };
			const errors = validateFieldConstraints(field, 'abc');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('at least 5');
		});

		it('should validate maxLength', () => {
			const field: Field = { name: 'title', type: 'text', maxLength: 3 };
			const errors = validateFieldConstraints(field, 'abcd');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('no more than 3');
		});

		it('should pass for valid length', () => {
			const field: Field = { name: 'title', type: 'text', minLength: 2, maxLength: 10 };
			expect(validateFieldConstraints(field, 'hello')).toEqual([]);
		});
	});

	describe('number field', () => {
		it('should skip validation when value is not a number', () => {
			const field: Field = { name: 'age', type: 'number', min: 0 };
			expect(validateFieldConstraints(field, 'not-a-number')).toEqual([]);
		});

		it('should validate min', () => {
			const field: Field = { name: 'age', type: 'number', min: 1 };
			const errors = validateFieldConstraints(field, 0);
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('at least 1');
		});

		it('should validate max', () => {
			const field: Field = { name: 'age', type: 'number', max: 100 };
			const errors = validateFieldConstraints(field, 101);
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('no more than 100');
		});

		it('should pass for value within range', () => {
			const field: Field = { name: 'age', type: 'number', min: 0, max: 100 };
			expect(validateFieldConstraints(field, 50)).toEqual([]);
		});

		it('should validate step with common values', () => {
			const field: Field = { name: 'price', type: 'number', step: 0.5 };
			expect(validateFieldConstraints(field, 1.5)).toEqual([]);
			expect(validateFieldConstraints(field, 2.0)).toEqual([]);
		});

		it('should reject value that does not align with step', () => {
			const field: Field = { name: 'price', type: 'number', step: 0.5 };
			const errors = validateFieldConstraints(field, 1.3);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]?.message).toContain('multiple of 0.5');
		});

		it('should handle floating point step 0.1 with value 0.3 (HIGH-RISK: float imprecision)', () => {
			const field: Field = { name: 'price', type: 'number', step: 0.1 };
			// 0.3 / 0.1 should be exactly 3, but float imprecision could cause issues
			const errors = validateFieldConstraints(field, 0.3);
			expect(errors).toEqual([]);
		});

		it('should skip step validation for negative step', () => {
			const field: Field = { name: 'price', type: 'number', step: -1 };
			// step > 0 guard should skip validation
			expect(validateFieldConstraints(field, 1.5)).toEqual([]);
		});

		it('should skip step validation for zero step', () => {
			const field: Field = { name: 'price', type: 'number', step: 0 };
			expect(validateFieldConstraints(field, 1.5)).toEqual([]);
		});
	});

	describe('email field', () => {
		it('should reject invalid email', () => {
			const field: Field = { name: 'email', type: 'email' };
			const errors = validateFieldConstraints(field, 'not-an-email');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('valid email');
		});

		it('should accept valid email', () => {
			const field: Field = { name: 'email', type: 'email' };
			expect(validateFieldConstraints(field, 'user@example.com')).toEqual([]);
		});

		it('should skip validation for empty string', () => {
			const field: Field = { name: 'email', type: 'email' };
			expect(validateFieldConstraints(field, '')).toEqual([]);
		});

		it('should skip validation for non-string value', () => {
			const field: Field = { name: 'email', type: 'email' };
			expect(validateFieldConstraints(field, 123)).toEqual([]);
		});
	});

	describe('select field', () => {
		const selectField: Field = {
			name: 'status',
			type: 'select',
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
			],
		};

		it('should accept valid single selection', () => {
			expect(validateFieldConstraints(selectField, 'draft')).toEqual([]);
		});

		it('should reject invalid single selection', () => {
			const errors = validateFieldConstraints(selectField, 'unknown');
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('invalid selection');
		});

		it('should skip validation for empty string (no selection)', () => {
			expect(validateFieldConstraints(selectField, '')).toEqual([]);
		});

		it('should accept valid multi-selection with hasMany', () => {
			const field: Field = { ...selectField, hasMany: true };
			expect(validateFieldConstraints(field, ['draft', 'published'])).toEqual([]);
		});

		it('should reject invalid multi-selection with hasMany', () => {
			const field: Field = { ...selectField, hasMany: true };
			const errors = validateFieldConstraints(field, ['draft', 'unknown']);
			expect(errors).toHaveLength(1);
		});

		it('should accept empty array with hasMany (no selection is valid)', () => {
			const field: Field = { ...selectField, hasMany: true };
			expect(validateFieldConstraints(field, [])).toEqual([]);
		});

		it('should handle hasMany=true with non-array value (falls to else branch)', () => {
			const field: Field = { ...selectField, hasMany: true };
			// Non-array value goes to else branch: validValues.has(value)
			const errors = validateFieldConstraints(field, 'draft');
			expect(errors).toEqual([]); // 'draft' is a valid option
		});

		it('should handle hasMany=true with non-array invalid value', () => {
			const field: Field = { ...selectField, hasMany: true };
			const errors = validateFieldConstraints(field, 'unknown');
			expect(errors).toHaveLength(1);
		});
	});

	describe('array field', () => {
		it('should validate minRows', () => {
			const field: Field = { name: 'items', type: 'array', fields: [], minRows: 2 };
			const errors = validateFieldConstraints(field, [{}, {}]);
			expect(errors).toHaveLength(0);

			const errorsShort = validateFieldConstraints(field, [{}]);
			expect(errorsShort).toHaveLength(1);
			expect(errorsShort[0]?.message).toContain('at least 2');
		});

		it('should validate maxRows', () => {
			const field: Field = { name: 'items', type: 'array', fields: [], maxRows: 2 };
			const errors = validateFieldConstraints(field, [{}, {}, {}]);
			expect(errors).toHaveLength(1);
			expect(errors[0]?.message).toContain('at most 2');
		});

		it('should skip validation for non-array value', () => {
			const field: Field = { name: 'items', type: 'array', fields: [], minRows: 2 };
			expect(validateFieldConstraints(field, 'not-array')).toEqual([]);
		});
	});

	describe('blocks field', () => {
		it('should validate minRows for blocks', () => {
			const field: Field = {
				name: 'content',
				type: 'blocks',
				blocks: [],
				minRows: 1,
			};
			const errors = validateFieldConstraints(field, []);
			expect(errors).toHaveLength(1);
		});

		it('should skip validation for non-array blocks value', () => {
			const field: Field = {
				name: 'content',
				type: 'blocks',
				blocks: [],
				minRows: 1,
			};
			expect(validateFieldConstraints(field, 'not-array')).toEqual([]);
		});
	});

	describe('unvalidated field types', () => {
		it('should return empty errors for richText', () => {
			const field: Field = { name: 'body', type: 'richText' };
			expect(validateFieldConstraints(field, 'anything')).toEqual([]);
		});

		it('should return empty errors for checkbox', () => {
			const field: Field = { name: 'active', type: 'checkbox' };
			expect(validateFieldConstraints(field, true)).toEqual([]);
		});

		it('should return empty errors for date', () => {
			const field: Field = { name: 'createdAt', type: 'date' };
			expect(validateFieldConstraints(field, '2024-01-01')).toEqual([]);
		});

		it('should return empty errors for json', () => {
			const field: Field = { name: 'data', type: 'json' };
			expect(validateFieldConstraints(field, { key: 'value' })).toEqual([]);
		});

		it('should return empty errors for point', () => {
			const field: Field = { name: 'location', type: 'point' };
			expect(validateFieldConstraints(field, { lat: 0, lng: 0 })).toEqual([]);
		});

		it('should return empty errors for slug', () => {
			const field: Field = { name: 'slug', type: 'slug', from: 'title' };
			expect(validateFieldConstraints(field, 'my-post')).toEqual([]);
		});
	});
});

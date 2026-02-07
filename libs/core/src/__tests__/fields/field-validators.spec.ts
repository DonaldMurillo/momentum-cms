import { describe, it, expect } from 'vitest';
import {
	text,
	textarea,
	number,
	email,
	password,
	select,
	radio,
	array,
	blocks,
} from '../../lib/fields';
import { validateFieldConstraints } from '../../lib/fields/field-validators';

describe('validateFieldConstraints', () => {
	describe('text fields', () => {
		it('should pass when value meets minLength', () => {
			const field = text('title', { minLength: 3 });
			const errors = validateFieldConstraints(field, 'abc');
			expect(errors).toEqual([]);
		});

		it('should fail when value is shorter than minLength', () => {
			const field = text('title', { minLength: 5 });
			const errors = validateFieldConstraints(field, 'ab');
			expect(errors).toEqual([
				{ field: 'title', message: 'Title must be at least 5 characters' },
			]);
		});

		it('should pass when value meets maxLength', () => {
			const field = text('title', { maxLength: 10 });
			const errors = validateFieldConstraints(field, 'short');
			expect(errors).toEqual([]);
		});

		it('should fail when value exceeds maxLength', () => {
			const field = text('title', { maxLength: 5 });
			const errors = validateFieldConstraints(field, 'too long value');
			expect(errors).toEqual([
				{ field: 'title', message: 'Title must be no more than 5 characters' },
			]);
		});

		it('should validate both minLength and maxLength', () => {
			const field = text('title', { minLength: 3, maxLength: 10 });
			expect(validateFieldConstraints(field, 'ab')).toHaveLength(1);
			expect(validateFieldConstraints(field, 'valid text')).toEqual([]);
			expect(validateFieldConstraints(field, 'way too long value')).toHaveLength(1);
		});

		it('should skip validation for null values', () => {
			const field = text('title', { minLength: 5 });
			expect(validateFieldConstraints(field, null)).toEqual([]);
		});

		it('should skip validation for undefined values', () => {
			const field = text('title', { minLength: 5 });
			expect(validateFieldConstraints(field, undefined)).toEqual([]);
		});

		it('should skip validation when no constraints defined', () => {
			const field = text('title');
			expect(validateFieldConstraints(field, 'anything')).toEqual([]);
		});

		it('should use label in error message when provided', () => {
			const field = text('title', { minLength: 5, label: 'Post Title' });
			const errors = validateFieldConstraints(field, 'ab');
			expect(errors).toEqual([
				{ field: 'title', message: 'Post Title must be at least 5 characters' },
			]);
		});
	});

	describe('textarea fields', () => {
		it('should validate minLength', () => {
			const field = textarea('content', { minLength: 10 });
			const errors = validateFieldConstraints(field, 'short');
			expect(errors).toEqual([
				{ field: 'content', message: 'Content must be at least 10 characters' },
			]);
		});

		it('should validate maxLength', () => {
			const field = textarea('content', { maxLength: 5 });
			const errors = validateFieldConstraints(field, 'too long value');
			expect(errors).toEqual([
				{ field: 'content', message: 'Content must be no more than 5 characters' },
			]);
		});

		it('should pass when within limits', () => {
			const field = textarea('content', { minLength: 2, maxLength: 20 });
			expect(validateFieldConstraints(field, 'valid')).toEqual([]);
		});
	});

	describe('password fields', () => {
		it('should validate minLength', () => {
			const field = password('pass', { minLength: 8 });
			const errors = validateFieldConstraints(field, 'short');
			expect(errors).toEqual([
				{ field: 'pass', message: 'Pass must be at least 8 characters' },
			]);
		});

		it('should pass when meeting minLength', () => {
			const field = password('pass', { minLength: 8 });
			expect(validateFieldConstraints(field, 'longpassword')).toEqual([]);
		});
	});

	describe('number fields', () => {
		it('should pass when value is within range', () => {
			const field = number('age', { min: 0, max: 150 });
			expect(validateFieldConstraints(field, 25)).toEqual([]);
		});

		it('should fail when value is below min', () => {
			const field = number('age', { min: 0 });
			const errors = validateFieldConstraints(field, -5);
			expect(errors).toEqual([
				{ field: 'age', message: 'Age must be at least 0' },
			]);
		});

		it('should fail when value is above max', () => {
			const field = number('age', { max: 150 });
			const errors = validateFieldConstraints(field, 200);
			expect(errors).toEqual([
				{ field: 'age', message: 'Age must be no more than 150' },
			]);
		});

		it('should validate step', () => {
			const field = number('quantity', { step: 5 });
			expect(validateFieldConstraints(field, 10)).toEqual([]);
			expect(validateFieldConstraints(field, 15)).toEqual([]);
			const errors = validateFieldConstraints(field, 7);
			expect(errors).toEqual([
				{ field: 'quantity', message: 'Quantity must be a multiple of 5' },
			]);
		});

		it('should handle step with floating point', () => {
			const field = number('price', { step: 0.01 });
			expect(validateFieldConstraints(field, 9.99)).toEqual([]);
			expect(validateFieldConstraints(field, 10.0)).toEqual([]);
		});

		it('should allow min of 0', () => {
			const field = number('count', { min: 0 });
			expect(validateFieldConstraints(field, 0)).toEqual([]);
		});

		it('should allow max of 0', () => {
			const field = number('temp', { max: 0 });
			expect(validateFieldConstraints(field, 0)).toEqual([]);
			expect(validateFieldConstraints(field, -5)).toEqual([]);
		});

		it('should skip validation for null values', () => {
			const field = number('age', { min: 0, max: 150 });
			expect(validateFieldConstraints(field, null)).toEqual([]);
		});

		it('should skip validation when no constraints defined', () => {
			const field = number('age');
			expect(validateFieldConstraints(field, 999)).toEqual([]);
		});

		it('should report both min and max violations', () => {
			const field = number('rating', { min: 1, max: 5 });
			expect(validateFieldConstraints(field, 0)).toHaveLength(1);
			expect(validateFieldConstraints(field, 6)).toHaveLength(1);
		});
	});

	describe('email fields', () => {
		it('should pass for valid email addresses', () => {
			const field = email('userEmail');
			expect(validateFieldConstraints(field, 'user@example.com')).toEqual([]);
			expect(validateFieldConstraints(field, 'first.last@domain.co.uk')).toEqual([]);
			expect(validateFieldConstraints(field, 'user+tag@example.org')).toEqual([]);
		});

		it('should fail for invalid email addresses', () => {
			const field = email('userEmail');
			expect(validateFieldConstraints(field, 'notanemail')).toHaveLength(1);
			expect(validateFieldConstraints(field, '@missing-local.com')).toHaveLength(1);
			expect(validateFieldConstraints(field, 'missing@.com')).toHaveLength(1);
			expect(validateFieldConstraints(field, 'missing-domain@')).toHaveLength(1);
			expect(validateFieldConstraints(field, 'spaces in@email.com')).toHaveLength(1);
		});

		it('should return descriptive error for invalid email', () => {
			const field = email('userEmail');
			const errors = validateFieldConstraints(field, 'invalid');
			expect(errors).toEqual([
				{ field: 'userEmail', message: 'User Email must be a valid email address' },
			]);
		});

		it('should skip validation for null/undefined', () => {
			const field = email('userEmail');
			expect(validateFieldConstraints(field, null)).toEqual([]);
			expect(validateFieldConstraints(field, undefined)).toEqual([]);
		});

		it('should skip validation for empty string', () => {
			const field = email('userEmail');
			expect(validateFieldConstraints(field, '')).toEqual([]);
		});
	});

	describe('select fields', () => {
		const options = [
			{ label: 'Active', value: 'active' },
			{ label: 'Draft', value: 'draft' },
			{ label: 'Archived', value: 'archived' },
		];

		it('should pass for valid option value', () => {
			const field = select('status', { options });
			expect(validateFieldConstraints(field, 'active')).toEqual([]);
			expect(validateFieldConstraints(field, 'draft')).toEqual([]);
		});

		it('should fail for invalid option value', () => {
			const field = select('status', { options });
			const errors = validateFieldConstraints(field, 'invalid');
			expect(errors).toEqual([
				{ field: 'status', message: 'Status has an invalid selection' },
			]);
		});

		it('should validate hasMany with array of valid values', () => {
			const field = select('tags', { options, hasMany: true });
			expect(validateFieldConstraints(field, ['active', 'draft'])).toEqual([]);
		});

		it('should fail hasMany when any value is invalid', () => {
			const field = select('tags', { options, hasMany: true });
			const errors = validateFieldConstraints(field, ['active', 'bad']);
			expect(errors).toEqual([
				{ field: 'tags', message: 'Tags has an invalid selection' },
			]);
		});

		it('should handle numeric option values', () => {
			const numOptions = [
				{ label: 'One', value: 1 },
				{ label: 'Two', value: 2 },
			];
			const field = select('rating', { options: numOptions });
			expect(validateFieldConstraints(field, 1)).toEqual([]);
			expect(validateFieldConstraints(field, 3)).toHaveLength(1);
		});

		it('should skip validation for null/undefined', () => {
			const field = select('status', { options });
			expect(validateFieldConstraints(field, null)).toEqual([]);
			expect(validateFieldConstraints(field, undefined)).toEqual([]);
		});
	});

	describe('radio fields', () => {
		const options = [
			{ label: 'Yes', value: 'yes' },
			{ label: 'No', value: 'no' },
		];

		it('should pass for valid option value', () => {
			const field = radio('confirm', { options });
			expect(validateFieldConstraints(field, 'yes')).toEqual([]);
		});

		it('should fail for invalid option value', () => {
			const field = radio('confirm', { options });
			const errors = validateFieldConstraints(field, 'maybe');
			expect(errors).toEqual([
				{ field: 'confirm', message: 'Confirm has an invalid selection' },
			]);
		});
	});

	describe('array fields', () => {
		const subFields = [text('item')];

		it('should pass when row count is within limits', () => {
			const field = array('items', { fields: subFields, minRows: 1, maxRows: 5 });
			expect(validateFieldConstraints(field, [{ item: 'a' }, { item: 'b' }])).toEqual([]);
		});

		it('should fail when below minRows', () => {
			const field = array('items', { fields: subFields, minRows: 2 });
			const errors = validateFieldConstraints(field, [{ item: 'a' }]);
			expect(errors).toEqual([
				{ field: 'items', message: 'Items requires at least 2 rows' },
			]);
		});

		it('should fail when above maxRows', () => {
			const field = array('items', { fields: subFields, maxRows: 2 });
			const items = [{ item: 'a' }, { item: 'b' }, { item: 'c' }];
			const errors = validateFieldConstraints(field, items);
			expect(errors).toEqual([
				{ field: 'items', message: 'Items allows at most 2 rows' },
			]);
		});

		it('should pass with empty array when no minRows', () => {
			const field = array('items', { fields: subFields });
			expect(validateFieldConstraints(field, [])).toEqual([]);
		});

		it('should fail with empty array when minRows > 0', () => {
			const field = array('items', { fields: subFields, minRows: 1 });
			const errors = validateFieldConstraints(field, []);
			expect(errors).toEqual([
				{ field: 'items', message: 'Items requires at least 1 rows' },
			]);
		});

		it('should skip validation for null/undefined', () => {
			const field = array('items', { fields: subFields, minRows: 1 });
			expect(validateFieldConstraints(field, null)).toEqual([]);
			expect(validateFieldConstraints(field, undefined)).toEqual([]);
		});

		it('should handle non-array values gracefully', () => {
			const field = array('items', { fields: subFields, minRows: 1 });
			expect(validateFieldConstraints(field, 'not-an-array')).toEqual([]);
		});
	});

	describe('blocks fields', () => {
		const blockConfigs = [
			{ slug: 'text', fields: [text('content')] },
			{ slug: 'image', fields: [text('url')] },
		];

		it('should pass when block count is within limits', () => {
			const field = blocks('content', { blocks: blockConfigs, minRows: 1, maxRows: 10 });
			const value = [{ blockType: 'text', content: 'hello' }];
			expect(validateFieldConstraints(field, value)).toEqual([]);
		});

		it('should fail when below minRows', () => {
			const field = blocks('content', { blocks: blockConfigs, minRows: 2 });
			const value = [{ blockType: 'text', content: 'hello' }];
			const errors = validateFieldConstraints(field, value);
			expect(errors).toEqual([
				{ field: 'content', message: 'Content requires at least 2 rows' },
			]);
		});

		it('should fail when above maxRows', () => {
			const field = blocks('content', { blocks: blockConfigs, maxRows: 1 });
			const value = [
				{ blockType: 'text', content: 'a' },
				{ blockType: 'image', url: 'b' },
			];
			const errors = validateFieldConstraints(field, value);
			expect(errors).toEqual([
				{ field: 'content', message: 'Content allows at most 1 rows' },
			]);
		});
	});

	describe('boundary values', () => {
		it('should pass text at exact minLength boundary', () => {
			const field = text('title', { minLength: 5 });
			expect(validateFieldConstraints(field, 'exact')).toEqual([]); // 5 chars
		});

		it('should pass text at exact maxLength boundary', () => {
			const field = text('title', { maxLength: 5 });
			expect(validateFieldConstraints(field, 'exact')).toEqual([]); // 5 chars
		});

		it('should fail text one below minLength boundary', () => {
			const field = text('title', { minLength: 5 });
			expect(validateFieldConstraints(field, 'four')).toHaveLength(1); // 4 chars
		});

		it('should fail text one above maxLength boundary', () => {
			const field = text('title', { maxLength: 5 });
			expect(validateFieldConstraints(field, 'sixsix')).toHaveLength(1); // 6 chars
		});

		it('should pass number at exact min boundary (non-zero)', () => {
			const field = number('age', { min: 18 });
			expect(validateFieldConstraints(field, 18)).toEqual([]);
		});

		it('should fail number one below min boundary (non-zero)', () => {
			const field = number('age', { min: 18 });
			expect(validateFieldConstraints(field, 17)).toHaveLength(1);
		});

		it('should pass number at exact max boundary (non-zero)', () => {
			const field = number('age', { max: 100 });
			expect(validateFieldConstraints(field, 100)).toEqual([]);
		});

		it('should fail number one above max boundary (non-zero)', () => {
			const field = number('age', { max: 100 });
			expect(validateFieldConstraints(field, 101)).toHaveLength(1);
		});
	});

	describe('type mismatch behavior', () => {
		it('should skip validation when text field receives a number', () => {
			const field = text('title', { minLength: 5 });
			expect(validateFieldConstraints(field, 42)).toEqual([]);
		});

		it('should skip validation when number field receives a string', () => {
			const field = number('age', { min: 0, max: 150 });
			expect(validateFieldConstraints(field, 'not a number')).toEqual([]);
		});
	});

	describe('select edge cases', () => {
		const options = [
			{ label: 'Active', value: 'active' },
			{ label: 'Draft', value: 'draft' },
		];

		it('should skip validation for array value when hasMany is false', () => {
			const field = select('status', { options });
			// Arrays silently pass when hasMany is not set — documents current behavior
			expect(validateFieldConstraints(field, ['active', 'draft'])).toEqual([]);
		});

		it('should validate scalar value when hasMany is true', () => {
			const field = select('tags', { options, hasMany: true });
			// Scalar value falls to the else-if branch, validating as scalar
			expect(validateFieldConstraints(field, 'active')).toEqual([]);
			expect(validateFieldConstraints(field, 'invalid')).toHaveLength(1);
		});

		it('should pass empty array for hasMany', () => {
			const field = select('tags', { options, hasMany: true });
			expect(validateFieldConstraints(field, [])).toEqual([]);
		});
	});

	describe('multiple simultaneous violations', () => {
		it('should report both min and step violations for number', () => {
			const field = number('quantity', { min: 10, step: 5 });
			const errors = validateFieldConstraints(field, 3);
			expect(errors).toHaveLength(2);
			expect(errors[0].message).toContain('at least 10');
			expect(errors[1].message).toContain('multiple of 5');
		});
	});

	describe('row count grammar', () => {
		it('should say "rows" for minRows of 1 (documents current behavior)', () => {
			const subFields = [text('item')];
			const field = array('items', { fields: subFields, minRows: 1 });
			const errors = validateFieldConstraints(field, []);
			expect(errors[0].message).toBe('Items requires at least 1 rows');
		});
	});

	describe('fields without constraints', () => {
		it('should return empty array for checkbox fields', () => {
			expect(validateFieldConstraints({ name: 'active', type: 'checkbox' }, true)).toEqual([]);
			expect(validateFieldConstraints({ name: 'active', type: 'checkbox' }, false)).toEqual([]);
		});

		it('should return empty array for date fields', () => {
			expect(
				validateFieldConstraints({ name: 'created', type: 'date' }, '2025-01-01'),
			).toEqual([]);
		});

		it('should return empty array for richText fields', () => {
			expect(
				validateFieldConstraints({ name: 'body', type: 'richText' }, '<p>hello</p>'),
			).toEqual([]);
		});

		it('should return empty array for json fields', () => {
			expect(
				validateFieldConstraints({ name: 'data', type: 'json' }, { key: 'value' }),
			).toEqual([]);
		});

		it('should return empty array for upload fields', () => {
			expect(
				validateFieldConstraints(
					{ name: 'image', type: 'upload', relationTo: 'media' },
					'some-id',
				),
			).toEqual([]);
		});

		it('should return empty array for relationship fields', () => {
			expect(
				validateFieldConstraints(
					{ name: 'author', type: 'relationship', collection: () => ({}) },
					'some-id',
				),
			).toEqual([]);
		});
	});
});

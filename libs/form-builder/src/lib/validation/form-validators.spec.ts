import { validateField, validateForm, isUnsafePattern } from './form-validators';
import type { FormFieldConfig } from '../types/form-schema.types';

describe('validateField', () => {
	it('should return required error for empty required field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text', required: true, label: 'Name' };
		const errors = validateField(field, '');
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('required');
		expect(errors[0].message).toBe('Name is required');
	});

	it('should return no errors for valid required field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text', required: true };
		expect(validateField(field, 'John')).toHaveLength(0);
	});

	it('should return no errors for empty optional field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text' };
		expect(validateField(field, '')).toHaveLength(0);
	});

	it('should return required error for null value', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text', required: true };
		expect(validateField(field, null)).toHaveLength(1);
	});

	it('should return required error for undefined value', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text', required: true };
		expect(validateField(field, undefined)).toHaveLength(1);
	});

	describe('text validation', () => {
		it('should validate minLength', () => {
			const field: FormFieldConfig = { name: 'bio', type: 'text', minLength: 5 };
			const errors = validateField(field, 'Hi');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('minLength');
		});

		it('should validate maxLength', () => {
			const field: FormFieldConfig = { name: 'bio', type: 'text', maxLength: 3 };
			const errors = validateField(field, 'Hello');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('maxLength');
		});

		it('should pass valid text length', () => {
			const field: FormFieldConfig = { name: 'bio', type: 'text', minLength: 2, maxLength: 10 };
			expect(validateField(field, 'Hello')).toHaveLength(0);
		});
	});

	describe('textarea validation', () => {
		it('should validate minLength on textarea', () => {
			const field: FormFieldConfig = { name: 'desc', type: 'textarea', minLength: 10 };
			expect(validateField(field, 'Short')).toHaveLength(1);
		});

		it('should validate maxLength on textarea', () => {
			const field: FormFieldConfig = { name: 'desc', type: 'textarea', maxLength: 5 };
			expect(validateField(field, 'Too long text')).toHaveLength(1);
		});
	});

	describe('email validation', () => {
		it('should reject invalid email', () => {
			const field: FormFieldConfig = { name: 'email', type: 'email' };
			const errors = validateField(field, 'not-an-email');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('email');
		});

		it('should accept valid email', () => {
			const field: FormFieldConfig = { name: 'email', type: 'email' };
			expect(validateField(field, 'test@example.com')).toHaveLength(0);
		});

		it('should also validate minLength on email', () => {
			const field: FormFieldConfig = { name: 'email', type: 'email', minLength: 20 };
			const errors = validateField(field, 'a@b.co');
			// a@b.co is valid email, so only minLength error
			expect(errors.some((e) => e.code === 'minLength')).toBe(true);
		});

		it('should return both email and minLength errors for invalid email', () => {
			const field: FormFieldConfig = { name: 'email', type: 'email', minLength: 20 };
			const errors = validateField(field, 'notanemail');
			expect(errors.some((e) => e.code === 'email')).toBe(true);
			expect(errors.some((e) => e.code === 'minLength')).toBe(true);
		});
	});

	describe('number validation', () => {
		it('should validate min', () => {
			const field: FormFieldConfig = { name: 'age', type: 'number', min: 18 };
			const errors = validateField(field, 10);
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('min');
		});

		it('should validate max', () => {
			const field: FormFieldConfig = { name: 'age', type: 'number', max: 100 };
			const errors = validateField(field, 150);
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('max');
		});

		it('should validate step', () => {
			const field: FormFieldConfig = { name: 'qty', type: 'number', step: 5 };
			const errors = validateField(field, 7);
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('step');
		});

		it('should accept 0.3 as a valid multiple of step 0.1', () => {
			const field: FormFieldConfig = { name: 'amount', type: 'number', step: 0.1 };
			expect(validateField(field, 0.3)).toHaveLength(0);
		});

		it('should accept 0.2 as a valid multiple of step 0.1', () => {
			const field: FormFieldConfig = { name: 'amount', type: 'number', step: 0.1 };
			expect(validateField(field, 0.2)).toHaveLength(0);
		});

		it('should accept 0.75 as a valid multiple of step 0.25', () => {
			const field: FormFieldConfig = { name: 'price', type: 'number', step: 0.25 };
			expect(validateField(field, 0.75)).toHaveLength(0);
		});

		it('should reject values that are genuinely not multiples of step', () => {
			const field: FormFieldConfig = { name: 'price', type: 'number', step: 0.25 };
			const errors = validateField(field, 0.3);
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('step');
		});

		it('should still pass integer multiples of step', () => {
			const field: FormFieldConfig = { name: 'qty', type: 'number', step: 5 };
			expect(validateField(field, 10)).toHaveLength(0);
		});

		it('should reject non-numeric value', () => {
			const field: FormFieldConfig = { name: 'age', type: 'number' };
			const errors = validateField(field, 'abc');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('number');
		});

		it('should pass valid number', () => {
			const field: FormFieldConfig = { name: 'age', type: 'number', min: 0, max: 100 };
			expect(validateField(field, 25)).toHaveLength(0);
		});
	});

	describe('select/radio validation', () => {
		const options = [
			{ label: 'Red', value: 'red' },
			{ label: 'Blue', value: 'blue' },
		];

		it('should reject invalid option', () => {
			const field: FormFieldConfig = { name: 'color', type: 'select', options };
			const errors = validateField(field, 'green');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('invalidOption');
		});

		it('should accept valid option', () => {
			const field: FormFieldConfig = { name: 'color', type: 'select', options };
			expect(validateField(field, 'red')).toHaveLength(0);
		});

		it('should validate radio options too', () => {
			const field: FormFieldConfig = { name: 'color', type: 'radio', options };
			expect(validateField(field, 'green')).toHaveLength(1);
			expect(validateField(field, 'blue')).toHaveLength(0);
		});
	});

	describe('pattern validation', () => {
		it('should validate regex pattern', () => {
			const field: FormFieldConfig = {
				name: 'zip',
				type: 'text',
				validation: { pattern: '^\\d{5}$', patternMessage: 'Must be 5 digits' },
			};
			const errors = validateField(field, 'abc');
			expect(errors).toHaveLength(1);
			expect(errors[0].code).toBe('pattern');
			expect(errors[0].message).toBe('Must be 5 digits');
		});

		it('should pass valid pattern', () => {
			const field: FormFieldConfig = {
				name: 'zip',
				type: 'text',
				validation: { pattern: '^\\d{5}$' },
			};
			expect(validateField(field, '12345')).toHaveLength(0);
		});

		it('should skip validation for unsafe patterns instead of always rejecting', () => {
			// An unsafe pattern should be SKIPPED (no error), not always fail.
			// This matches client-side behavior where no validator is registered.
			const field: FormFieldConfig = {
				name: 'test',
				type: 'text',
				validation: { pattern: '(a+)+$' },
			};
			const errors = validateField(field, 'perfectly-valid-input');
			expect(errors).toHaveLength(0);
		});

		it('should skip validation for unsafe patterns even with non-matching input', () => {
			const field: FormFieldConfig = {
				name: 'test',
				type: 'text',
				validation: { pattern: '(a+)+$' },
			};
			const errors = validateField(field, 'anything at all!');
			expect(errors).toHaveLength(0);
		});

		it('should complete in <1s even with dangerous patterns (ReDoS protection)', () => {
			const field: FormFieldConfig = {
				name: 'test',
				type: 'text',
				validation: { pattern: '(a+)+$' },
			};
			const start = Date.now();
			validateField(field, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!');
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(1000);
		});

		it('should skip validation for invalid regex patterns to match client-side behavior', () => {
			// Invalid regex should skip validation (no error), matching client-side where
			// no validator is registered for patterns that fail new RegExp(pattern).
			// Previously this returned false (always errored), breaking all submissions.
			const field: FormFieldConfig = {
				name: 'test',
				type: 'text',
				validation: { pattern: '[invalid(' },
			};
			const errors = validateField(field, 'test');
			expect(errors).toHaveLength(0);
		});
	});

	describe('multiple errors', () => {
		it('should return multiple errors for a field', () => {
			const field: FormFieldConfig = {
				name: 'email',
				type: 'email',
				minLength: 50,
			};
			const errors = validateField(field, 'bad');
			expect(errors.length).toBeGreaterThanOrEqual(2);
		});
	});
});

describe('validateForm', () => {
	it('should validate all fields and return combined errors', () => {
		const fields: FormFieldConfig[] = [
			{ name: 'name', type: 'text', required: true },
			{ name: 'email', type: 'email', required: true },
		];
		const errors = validateForm(fields, { name: '', email: '' });
		expect(errors).toHaveLength(2);
		expect(errors[0].field).toBe('name');
		expect(errors[1].field).toBe('email');
	});

	it('should return empty array when all fields are valid', () => {
		const fields: FormFieldConfig[] = [
			{ name: 'name', type: 'text', required: true },
			{ name: 'email', type: 'email', required: true },
		];
		const errors = validateForm(fields, { name: 'John', email: 'john@example.com' });
		expect(errors).toHaveLength(0);
	});

	it('should handle missing field values', () => {
		const fields: FormFieldConfig[] = [{ name: 'name', type: 'text', required: true }];
		const errors = validateForm(fields, {});
		expect(errors).toHaveLength(1);
	});
});

describe('isUnsafePattern — ReDoS detection', () => {
	it('should detect nested quantifiers with {m,n} syntax', () => {
		expect(isUnsafePattern('(a{1,10}){1,10}')).toBe(true);
	});

	it('should detect {n,} unbounded repetition nested in group', () => {
		expect(isUnsafePattern('(a{2,}){2,}')).toBe(true);
	});

	it('should detect mixed: {m,n} inside, + outside', () => {
		expect(isUnsafePattern('(a{1,10})+')).toBe(true);
	});

	it('should detect mixed: + inside, {m,n} outside', () => {
		expect(isUnsafePattern('(a+){1,10}')).toBe(true);
	});

	it('should detect {n} exact repetition as outer quantifier', () => {
		expect(isUnsafePattern('(a+){10}')).toBe(true);
	});

	it('should still detect classic + and * nested quantifiers', () => {
		expect(isUnsafePattern('(a+)+')).toBe(true);
		expect(isUnsafePattern('(a*)*')).toBe(true);
		expect(isUnsafePattern('(a+)*')).toBe(true);
	});

	it('should not flag safe patterns with {m,n}', () => {
		expect(isUnsafePattern('a{1,10}')).toBe(false);
		expect(isUnsafePattern('^\\d{5}$')).toBe(false);
		expect(isUnsafePattern('[a-z]{2,4}')).toBe(false);
	});

	it('should complete validation of dangerous {m,n} pattern in <100ms', () => {
		const field: FormFieldConfig = {
			name: 'test',
			type: 'text',
			validation: { pattern: '(a{1,10}){1,10}' },
		};
		const start = Date.now();
		validateField(field, 'a'.repeat(100) + '!');
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(100);
	});

	it('should detect non-capturing groups with nested quantifiers', () => {
		expect(isUnsafePattern('(?:a+)+')).toBe(true);
		expect(isUnsafePattern('(?:a*)+')).toBe(true);
		expect(isUnsafePattern('(?:a{1,10})+')).toBe(true);
	});

	it('should detect character class groups with quantifiers', () => {
		expect(isUnsafePattern('([a-z]+\\s?)+')).toBe(true);
		expect(isUnsafePattern('(\\d+\\.?)+')).toBe(true);
	});

	it('should reject patterns exceeding max length as unsafe', () => {
		const longPattern = '^[a-z]'.repeat(50); // 300 chars
		expect(isUnsafePattern(longPattern)).toBe(true);
	});
});

describe('select/radio with numeric option values', () => {
	it('should accept string value matching numeric option', () => {
		const field: FormFieldConfig = {
			name: 'priority',
			type: 'select',
			options: [
				{ label: 'Low', value: 1 },
				{ label: 'High', value: 2 },
			],
		};
		expect(validateField(field, '1')).toHaveLength(0);
	});

	it('should accept numeric value matching numeric option', () => {
		const field: FormFieldConfig = {
			name: 'priority',
			type: 'select',
			options: [
				{ label: 'Low', value: 1 },
				{ label: 'High', value: 2 },
			],
		};
		expect(validateField(field, 1)).toHaveLength(0);
	});

	it('should still reject invalid option for numeric options', () => {
		const field: FormFieldConfig = {
			name: 'priority',
			type: 'select',
			options: [
				{ label: 'Low', value: 1 },
				{ label: 'High', value: 2 },
			],
		};
		const errors = validateField(field, '3');
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidOption');
	});

	it('should still accept string options matched by string value', () => {
		const field: FormFieldConfig = {
			name: 'color',
			type: 'select',
			options: [
				{ label: 'Red', value: 'red' },
				{ label: 'Blue', value: 'blue' },
			],
		};
		expect(validateField(field, 'red')).toHaveLength(0);
	});

	it('should work for radio fields with numeric options', () => {
		const field: FormFieldConfig = {
			name: 'rating',
			type: 'radio',
			options: [
				{ label: '1 Star', value: 1 },
				{ label: '5 Stars', value: 5 },
			],
		};
		expect(validateField(field, '5')).toHaveLength(0);
		expect(validateField(field, '3')).toHaveLength(1);
	});
});

describe('type enforcement', () => {
	it('should reject object value for text field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text' };
		const errors = validateField(field, { nested: 'object' });
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should reject array value for text field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text' };
		const errors = validateField(field, ['array']);
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should reject object value for email field', () => {
		const field: FormFieldConfig = { name: 'email', type: 'email' };
		const errors = validateField(field, { html: '<script>alert(1)</script>' });
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should reject object value for textarea field', () => {
		const field: FormFieldConfig = { name: 'bio', type: 'textarea' };
		const errors = validateField(field, { content: 'malicious' });
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should reject object value for number field', () => {
		const field: FormFieldConfig = { name: 'age', type: 'number' };
		const errors = validateField(field, { value: 42 });
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should allow string value for number field (HTML forms submit as strings)', () => {
		const field: FormFieldConfig = { name: 'age', type: 'number' };
		expect(validateField(field, '25')).toHaveLength(0);
	});

	it('should reject object value for checkbox field', () => {
		const field: FormFieldConfig = { name: 'agree', type: 'checkbox' };
		const errors = validateField(field, { checked: true });
		expect(errors).toHaveLength(1);
		expect(errors[0].code).toBe('invalidType');
	});

	it('should allow boolean value for checkbox field', () => {
		const field: FormFieldConfig = { name: 'agree', type: 'checkbox' };
		expect(validateField(field, true)).toHaveLength(0);
	});

	it('should allow string value for checkbox field', () => {
		const field: FormFieldConfig = { name: 'agree', type: 'checkbox' };
		expect(validateField(field, 'true')).toHaveLength(0);
	});

	it('should still allow normal string for text field', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text' };
		expect(validateField(field, 'John Doe')).toHaveLength(0);
	});

	it('should not type-check empty/null values (required check handles those)', () => {
		const field: FormFieldConfig = { name: 'name', type: 'text' };
		expect(validateField(field, null)).toHaveLength(0);
		expect(validateField(field, undefined)).toHaveLength(0);
		expect(validateField(field, '')).toHaveLength(0);
	});
});

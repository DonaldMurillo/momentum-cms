/**
 * Pure validation functions for form fields.
 *
 * Zero Angular dependencies - runs in browser and Node.
 * This module is exported via `@momentumcms/form-builder/validation`.
 */

import type { FormFieldConfig } from '../types/form-schema.types';

// Re-export FormFieldConfig so server-side code can import from the validation sub-path
export type { FormFieldConfig };

/**
 * A single validation error.
 */
export interface FormValidationError {
	/** The field name. */
	field: string;
	/** Human-readable error message. */
	message: string;
	/** Error code for programmatic handling. */
	code: string;
}

/** Allowed runtime types for each field type. */
const EXPECTED_TYPES: Record<string, string[]> = {
	text: ['string'],
	textarea: ['string'],
	email: ['string'],
	number: ['number', 'string'],
	checkbox: ['boolean', 'string'],
	select: ['string', 'number'],
	radio: ['string', 'number'],
	date: ['string'],
	hidden: ['string', 'number'],
};

/**
 * Validate a single field value.
 *
 * @returns Array of errors (empty if valid).
 */
export function validateField(field: FormFieldConfig, value: unknown): FormValidationError[] {
	const errors: FormValidationError[] = [];
	const name = field.name;

	// Required check
	if (field.required && isEmpty(value)) {
		errors.push({ field: name, message: `${field.label ?? name} is required`, code: 'required' });
		return errors; // Skip further validation if empty and required
	}

	// Skip further validation if value is empty and not required
	if (isEmpty(value)) {
		return errors;
	}

	// Type enforcement — reject objects, arrays, and other unexpected types
	const allowed = EXPECTED_TYPES[field.type];
	if (allowed && !allowed.includes(typeof value)) {
		errors.push({
			field: name,
			message: `${field.label ?? name} has an invalid value type`,
			code: 'invalidType',
		});
		return errors;
	}

	const strValue = typeof value === 'string' ? value : '';

	// Type-specific validation
	switch (field.type) {
		case 'text':
		case 'textarea':
			validateTextConstraints(field, strValue, errors);
			break;
		case 'email':
			validateEmailFormat(strValue, name, errors);
			validateTextConstraints(field, strValue, errors);
			break;
		case 'number':
			validateNumberConstraints(field, value, errors);
			break;
		case 'select':
		case 'radio':
			validateOptionValue(field, value, errors);
			break;
	}

	// Pattern validation — with ReDoS protection
	if (field.validation?.pattern && typeof value === 'string') {
		if (!safeRegexTest(field.validation.pattern, value)) {
			errors.push({
				field: name,
				message: field.validation.patternMessage ?? `${field.label ?? name} format is invalid`,
				code: 'pattern',
			});
		}
	}

	return errors;
}

/**
 * Validate all field values against a set of field configs.
 *
 * @returns Array of all errors across all fields.
 */
export function validateForm(
	fields: FormFieldConfig[],
	values: Record<string, unknown>,
): FormValidationError[] {
	return fields.flatMap((field) => validateField(field, values[field.name]));
}

// ─── Internal helpers ───────────────────────────────────────────────

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string' && value.trim() === '') return true;
	return false;
}

function validateTextConstraints(
	field: FormFieldConfig,
	value: string,
	errors: FormValidationError[],
): void {
	const name = field.name;
	if (field.minLength != null && value.length < field.minLength) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be at least ${field.minLength} characters`,
			code: 'minLength',
		});
	}
	if (field.maxLength != null && value.length > field.maxLength) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be at most ${field.maxLength} characters`,
			code: 'maxLength',
		});
	}
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateEmailFormat(value: string, name: string, errors: FormValidationError[]): void {
	if (!EMAIL_REGEX.test(value)) {
		errors.push({ field: name, message: 'Invalid email address', code: 'email' });
	}
}

function validateNumberConstraints(
	field: FormFieldConfig,
	value: unknown,
	errors: FormValidationError[],
): void {
	const name = field.name;
	const num = typeof value === 'number' ? value : Number(value);

	if (isNaN(num)) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be a number`,
			code: 'number',
		});
		return;
	}

	if (field.min != null && num < field.min) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be at least ${field.min}`,
			code: 'min',
		});
	}
	if (field.max != null && num > field.max) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be at most ${field.max}`,
			code: 'max',
		});
	}
	if (field.step != null && !isMultipleOf(num, field.step)) {
		errors.push({
			field: name,
			message: `${field.label ?? name} must be a multiple of ${field.step}`,
			code: 'step',
		});
	}
}

/**
 * Tolerance-based check for whether `value` is a multiple of `step`.
 * Avoids floating-point modulo errors (e.g. 0.3 % 0.1 !== 0 in JS).
 */
function isMultipleOf(value: number, step: number): boolean {
	const remainder = Math.abs(value % step);
	const tolerance = Number.EPSILON * Math.max(Math.abs(value), Math.abs(step)) * 100;
	return remainder < tolerance || Math.abs(remainder - Math.abs(step)) < tolerance;
}

function validateOptionValue(
	field: FormFieldConfig,
	value: unknown,
	errors: FormValidationError[],
): void {
	if (!field.options || field.options.length === 0) return;
	// Coerce both sides to strings to handle numeric option values submitted as strings from HTML forms
	const validValues = new Set(field.options.map((o) => String(o.value)));
	const coerced = String(value);
	if (!validValues.has(coerced)) {
		errors.push({
			field: field.name,
			message: `${field.label ?? field.name} has an invalid selection`,
			code: 'invalidOption',
		});
	}
}

/**
 * Detect regex patterns vulnerable to catastrophic backtracking (ReDoS).
 * Catches nested quantifiers: (a+)+, (a*)+, (a{1,10}){1,10}, (a+){2,}, etc.
 * A quantifier is +, *, or {n}, {n,}, {n,m}.
 */
const QUANTIFIER = String.raw`(?:[+*]|\{\d+(?:,\d*)?\})`;
const DANGEROUS_PATTERN = new RegExp(
	// Group with inner quantifier followed by outer quantifier
	String.raw`\(.+(?:[+*]|\{\d+(?:,\d*)?\})\)${QUANTIFIER}` +
		'|' +
		// Alternation group followed by quantifier
		String.raw`\([^)]*\|[^)]*\)${QUANTIFIER}`,
);

export function isUnsafePattern(pattern: string): boolean {
	return DANGEROUS_PATTERN.test(pattern);
}

/**
 * Safely test a regex pattern against a value.
 * Rejects patterns with nested quantifiers (ReDoS risk) and
 * handles invalid regex gracefully.
 *
 * Returns `true` if the pattern matches, `false` if it doesn't match,
 * the pattern is invalid, or the pattern is unsafe.
 */
function safeRegexTest(pattern: string, value: string): boolean {
	try {
		if (isUnsafePattern(pattern)) {
			return false;
		}
		const regex = new RegExp(pattern);
		return regex.test(value);
	} catch {
		// Invalid regex pattern — treat as non-matching
		return false;
	}
}

/**
 * Built-in field constraint validators for Momentum CMS.
 *
 * Pure functions that validate field values against type-specific constraints
 * (minLength, maxLength, min, max, step, minRows, maxRows, email format, select options).
 * Shared by server-core (server-side validation) and admin (client-side validation).
 */

import type { Field } from './field.types';
import { humanizeFieldName } from './humanize-field-name';

export interface FieldConstraintError {
	field: string;
	message: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a field's value against its built-in constraints.
 * Returns an array of errors (empty if valid).
 * Skips validation for null/undefined values (required-check is separate).
 */
export function validateFieldConstraints(field: Field, value: unknown): FieldConstraintError[] {
	if (value === null || value === undefined) {
		return [];
	}

	const label = field.label ?? humanizeFieldName(field.name);
	const errors: FieldConstraintError[] = [];

	switch (field.type) {
		case 'text':
		case 'textarea':
			if (typeof value === 'string') {
				validateStringLength(field.name, label, value, field.minLength, field.maxLength, errors);
			}
			break;

		case 'password':
			if (typeof value === 'string' && field.minLength !== undefined) {
				validateStringLength(field.name, label, value, field.minLength, undefined, errors);
			}
			break;

		case 'number':
			if (typeof value === 'number') {
				if (field.min !== undefined && value < field.min) {
					errors.push({ field: field.name, message: `${label} must be at least ${field.min}` });
				}
				if (field.max !== undefined && value > field.max) {
					errors.push({
						field: field.name,
						message: `${label} must be no more than ${field.max}`,
					});
				}
				if (field.step !== undefined && field.step > 0) {
					// Use rounding to handle floating point precision
					const remainder = Math.abs(Math.round((value / field.step) * 1e10) % Math.round(1e10));
					if (remainder > 1) {
						errors.push({
							field: field.name,
							message: `${label} must be a multiple of ${field.step}`,
						});
					}
				}
			}
			break;

		case 'email':
			if (typeof value === 'string' && value !== '' && !EMAIL_REGEX.test(value)) {
				errors.push({
					field: field.name,
					message: `${label} must be a valid email address`,
				});
			}
			break;

		case 'select':
			validateSelectOptions(field.name, label, value, field.options, field.hasMany, errors);
			break;

		case 'radio':
			validateSelectOptions(field.name, label, value, field.options, false, errors);
			break;

		case 'array':
			if (Array.isArray(value)) {
				validateRowCount(field.name, label, value.length, field.minRows, field.maxRows, errors);
			}
			break;

		case 'blocks':
			if (Array.isArray(value)) {
				validateRowCount(field.name, label, value.length, field.minRows, field.maxRows, errors);
			}
			break;
	}

	return errors;
}

function validateStringLength(
	name: string,
	label: string,
	value: string,
	minLength: number | undefined,
	maxLength: number | undefined,
	errors: FieldConstraintError[],
): void {
	if (minLength !== undefined && value.length < minLength) {
		errors.push({ field: name, message: `${label} must be at least ${minLength} characters` });
	}
	if (maxLength !== undefined && value.length > maxLength) {
		errors.push({
			field: name,
			message: `${label} must be no more than ${maxLength} characters`,
		});
	}
}

function validateSelectOptions(
	name: string,
	label: string,
	value: unknown,
	options: ReadonlyArray<{ value: string | number }>,
	hasMany: boolean | undefined,
	errors: FieldConstraintError[],
): void {
	// Empty string means "no selection" for non-required fields — skip validation
	if (value === '') return;

	const validValues = new Set(options.map((o) => o.value));

	if (hasMany && Array.isArray(value)) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- array elements are string | number from select options
		const allValid = value.every((v) => validValues.has(v as string | number));
		if (!allValid) {
			errors.push({ field: name, message: `${label} has an invalid selection` });
		}
	} else if (!Array.isArray(value)) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- value is string | number from select options
		if (!validValues.has(value as string | number)) {
			errors.push({ field: name, message: `${label} has an invalid selection` });
		}
	}
}

function validateRowCount(
	name: string,
	label: string,
	count: number,
	minRows: number | undefined,
	maxRows: number | undefined,
	errors: FieldConstraintError[],
): void {
	if (minRows !== undefined && count < minRows) {
		errors.push({ field: name, message: `${label} requires at least ${minRows} rows` });
	}
	if (maxRows !== undefined && count > maxRows) {
		errors.push({ field: name, message: `${label} allows at most ${maxRows} rows` });
	}
}

/**
 * Evaluate visibility conditions for form fields.
 *
 * Pure function — no Angular dependencies.
 */

import type { FormCondition } from '../types/form-schema.types';

/**
 * Evaluate whether a set of conditions are met.
 * All conditions must be true (AND logic).
 *
 * @returns `true` if the field should be visible.
 */
export function evaluateConditions(
	conditions: FormCondition[],
	values: Record<string, unknown>,
): boolean {
	if (conditions.length === 0) return true;
	return conditions.every((condition) => evaluateSingleCondition(condition, values));
}

function evaluateSingleCondition(
	condition: FormCondition,
	values: Record<string, unknown>,
): boolean {
	if (!(condition.field in values)) {
		return false;
	}

	const fieldValue = values[condition.field];

	switch (condition.operator) {
		case 'equals':
			return fieldValue === condition.value;
		case 'not_equals':
			return fieldValue !== condition.value;
		case 'contains': {
			if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
			return fieldValue.includes(condition.value);
		}
		case 'not_empty':
			return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
		case 'empty':
			return fieldValue === null || fieldValue === undefined || fieldValue === '';
		default:
			return false;
	}
}

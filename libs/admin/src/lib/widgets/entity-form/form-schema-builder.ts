/**
 * Dynamic schema generator for Angular Signal Forms.
 *
 * Maps Momentum CMS collection field definitions to signal forms validators at runtime.
 * Handles nested structures (groups via `apply()`, arrays via `applyEach()`).
 *
 * Since collections define fields at runtime (not compile time), all schema paths
 * are accessed via bracket notation on `Record<string, unknown>` models.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to cast dynamic fieldPath to typed SchemaPath */

import {
	required,
	email,
	min,
	max,
	minLength,
	maxLength,
	validate,
	apply,
	applyEach,
} from '@angular/forms/signals';
import type { SchemaPath } from '@angular/forms/signals';
import { flattenDataFields, humanizeFieldName } from '@momentumcms/core';
import type { Field } from '@momentumcms/core';

/**
 * Applies collection field validators to a signal forms schema path tree.
 *
 * @param fields - Collection field definitions
 * @param schemaPathTree - The schema path tree node (from `form()` or `apply()` callback)
 * @param getFormData - Optional function that returns the current form model data (for cross-field validators)
 */
export function applyCollectionSchema(
	fields: Field[],
	schemaPathTree: Record<string, unknown>,
	getFormData?: () => Record<string, unknown>,
): void {
	for (const field of flattenDataFields(fields)) {
		const fieldPath = schemaPathTree[field.name];
		if (!fieldPath) continue;

		const label = field.label ?? humanizeFieldName(field.name);

		// Required validator
		if (field.required) {
			required(fieldPath as SchemaPath<unknown>, {
				message: `${label} is required`,
			});
		}

		// Type-specific validators
		switch (field.type) {
			case 'text':
			case 'textarea': {
				if (field.minLength !== undefined) {
					minLength(fieldPath as SchemaPath<string>, field.minLength, {
						message: `${label} must be at least ${field.minLength} characters`,
					});
				}
				if (field.maxLength !== undefined) {
					maxLength(fieldPath as SchemaPath<string>, field.maxLength, {
						message: `${label} must be no more than ${field.maxLength} characters`,
					});
				}
				break;
			}

			case 'password': {
				if (field.minLength !== undefined) {
					minLength(fieldPath as SchemaPath<string>, field.minLength, {
						message: `${label} must be at least ${field.minLength} characters`,
					});
				}
				break;
			}

			case 'number': {
				if (field.min !== undefined) {
					min(fieldPath as SchemaPath<number | null>, field.min, {
						message: `${label} must be at least ${field.min}`,
					});
				}
				if (field.max !== undefined) {
					max(fieldPath as SchemaPath<number | null>, field.max, {
						message: `${label} must be no more than ${field.max}`,
					});
				}
				break;
			}

			case 'email': {
				email(fieldPath as SchemaPath<string>, {
					message: `${label} must be a valid email address`,
				});
				break;
			}

			case 'select': {
				const validValues = new Set(field.options.map((opt) => opt.value));
				validate(fieldPath as SchemaPath<string>, ({ value }) => {
					const v = value();
					if (v === '' || v === null || v === undefined) return null;
					if (!validValues.has(v as string)) {
						return {
							kind: 'invalidOption',
							message: `${label} must be one of the available options`,
						};
					}
					return null;
				});
				break;
			}

			case 'group': {
				apply(
					fieldPath as SchemaPath<Record<string, unknown>>,
					(groupPath: Record<string, unknown>) => {
						applyCollectionSchema(field.fields, groupPath, getFormData);
					},
				);
				break;
			}

			case 'array': {
				// Array-level row count validators
				if (field.minRows !== undefined) {
					const minRowCount = field.minRows;
					validate(fieldPath as SchemaPath<unknown[]>, ({ value }) => {
						const arr = value();
						if (!Array.isArray(arr)) return null;
						if (arr.length < minRowCount) {
							return {
								kind: 'minRows',
								message: `${label} must have at least ${minRowCount} row${minRowCount === 1 ? '' : 's'}`,
							};
						}
						return null;
					});
				}
				if (field.maxRows !== undefined) {
					const maxRowCount = field.maxRows;
					validate(fieldPath as SchemaPath<unknown[]>, ({ value }) => {
						const arr = value();
						if (!Array.isArray(arr)) return null;
						if (arr.length > maxRowCount) {
							return {
								kind: 'maxRows',
								message: `${label} must have no more than ${maxRowCount} row${maxRowCount === 1 ? '' : 's'}`,
							};
						}
						return null;
					});
				}

				// Apply sub-field validators to each array item
				if (field.fields.length > 0) {
					applyEach(
						fieldPath as SchemaPath<Record<string, unknown>[]>,
						(itemPath: Record<string, unknown>) => {
							applyCollectionSchema(field.fields, itemPath, getFormData);
						},
					);
				}
				break;
			}

			// blocks field - validate minRows/maxRows only (sub-schemas per block type
			// would require applyWhenValue which needs discriminated unions)
			case 'blocks': {
				if (field.minRows !== undefined) {
					const minRowCount = field.minRows;
					validate(fieldPath as SchemaPath<unknown[]>, ({ value }) => {
						const arr = value();
						if (!Array.isArray(arr)) return null;
						if (arr.length < minRowCount) {
							return {
								kind: 'minRows',
								message: `${label} must have at least ${minRowCount} block${minRowCount === 1 ? '' : 's'}`,
							};
						}
						return null;
					});
				}
				if (field.maxRows !== undefined) {
					const maxRowCount = field.maxRows;
					validate(fieldPath as SchemaPath<unknown[]>, ({ value }) => {
						const arr = value();
						if (!Array.isArray(arr)) return null;
						if (arr.length > maxRowCount) {
							return {
								kind: 'maxRows',
								message: `${label} must have no more than ${maxRowCount} block${maxRowCount === 1 ? '' : 's'}`,
							};
						}
						return null;
					});
				}
				break;
			}

			default:
				// Other field types (date, checkbox, upload, relationship, richText, etc.)
				// have no additional built-in constraints beyond required
				break;
		}

		// Custom validate function from field definition
		if (field.validate) {
			const customValidate = field.validate;
			validate(fieldPath as SchemaPath<unknown>, ({ value }) => {
				const data = getFormData ? getFormData() : {};
				const result = customValidate(value(), { data, req: {} });
				// Signal forms validators are synchronous — async validators
				// (returning Promise) cannot be awaited here. They are enforced
				// server-side; warn developers so it's not a silent failure.
				if (result && typeof result === 'object' && 'then' in result) {
					console.warn(
						`[Momentum] Custom validator on field "${field.name}" returned a Promise. ` +
							`Async validators are not supported client-side and will be enforced server-side only.`,
					);
					return null;
				}
				if (typeof result === 'string') {
					return { kind: 'custom', message: result };
				}
				return null;
			});
		}
	}
}

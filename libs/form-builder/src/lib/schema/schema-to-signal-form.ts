/**
 * Converts a FormSchema into an Angular Signal Forms model and applies validators.
 *
 * Maps FormFieldConfig definitions to signal forms validators at runtime,
 * similar to `applyCollectionSchema` in the admin package but using
 * the standalone FormFieldConfig types (no CMS dependency).
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for dynamic schema paths */

import { signal, type Injector, type WritableSignal } from '@angular/core';
import {
	form,
	required,
	email,
	min,
	max,
	minLength,
	maxLength,
	validate,
} from '@angular/forms/signals';
import type { FieldTree, SchemaPath } from '@angular/forms/signals';
import type { FormFieldConfig, FormSchema } from '../types/form-schema.types';
import { isUnsafePattern } from '../validation/form-validators';

/**
 * The return type of `createFormFromSchema`.
 */
export interface FormBuilderForm {
	/** The writable signal holding the form model data. */
	model: WritableSignal<Record<string, unknown>>;
	/** The signal form tree (returned by `form()`). */
	formTree: FieldTree<Record<string, unknown>>;
}

/**
 * Build an initial data model from a FormSchema by using field defaults.
 *
 * Pure function — no Angular dependency.
 */
export function buildInitialModel(schema: FormSchema): Record<string, unknown> {
	const model: Record<string, unknown> = {};
	for (const field of schema.fields) {
		model[field.name] = field.defaultValue ?? getTypeDefault(field.type);
	}
	return model;
}

/**
 * Create a signal form from a FormSchema.
 *
 * Must run inside an Angular injection context (component, service, or
 * `runInInjectionContext()`), OR pass an `Injector` via the options.
 *
 * @returns The signal form tree with all validators applied.
 */
export function createFormFromSchema(
	schema: FormSchema,
	options?: { injector?: Injector },
): FormBuilderForm {
	const model = signal(buildInitialModel(schema));
	const schemaFn = (root: Record<string, unknown>): void => {
		applyFormFieldValidators(schema.fields, root);
	};
	const formTree = options?.injector
		? form(model, schemaFn, { injector: options.injector })
		: form(model, schemaFn);
	return { model, formTree };
}

/**
 * Apply form field validators to a signal forms schema path tree.
 *
 * Use inside a `form()` schema callback:
 * ```ts
 * form(myModel, (tree) => {
 *   applyFormFieldValidators(fields, tree as Record<string, unknown>);
 * });
 * ```
 */
export function applyFormFieldValidators(
	fields: FormFieldConfig[],
	schemaPathTree: Record<string, unknown>,
): void {
	for (const field of fields) {
		const fieldPath = schemaPathTree[field.name];
		if (!fieldPath) continue;

		const label = field.label ?? field.name;

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
				applyTextValidators(field, fieldPath, label);
				break;
			}

			case 'email': {
				email(fieldPath as SchemaPath<string>, {
					message: `${label} must be a valid email address`,
				});
				applyTextValidators(field, fieldPath, label);
				break;
			}

			case 'number': {
				if (field.min != null) {
					min(fieldPath as SchemaPath<number | null>, field.min, {
						message: `${label} must be at least ${field.min}`,
					});
				}
				if (field.max != null) {
					max(fieldPath as SchemaPath<number | null>, field.max, {
						message: `${label} must be no more than ${field.max}`,
					});
				}
				break;
			}

			case 'select':
			case 'radio': {
				if (field.options && field.options.length > 0) {
					const validValues = new Set(field.options.map((opt) => opt.value));
					validate(fieldPath as SchemaPath<string | number>, ({ value }) => {
						const v = value();
						if (v === '' || v === null || v === undefined) return null;
						if (!validValues.has(v as string | number)) {
							return {
								kind: 'invalidOption',
								message: `${label} must be one of the available options`,
							};
						}
						return null;
					});
				}
				break;
			}

			default:
				// checkbox, date, hidden: no additional validators beyond required
				break;
		}

		// Pattern validation — with safety checks matching server-side behavior
		if (field.validation?.pattern) {
			let regex: RegExp | null = null;
			try {
				if (!isUnsafePattern(field.validation.pattern)) {
					regex = new RegExp(field.validation.pattern);
				}
			} catch {
				// Invalid regex — skip pattern validator entirely
			}

			if (regex) {
				const safeRegex = regex;
				const patternMessage = field.validation.patternMessage ?? `${label} format is invalid`;
				validate(fieldPath as SchemaPath<string>, ({ value }) => {
					const v = value();
					if (typeof v !== 'string' || v === '') return null;
					if (!safeRegex.test(v)) {
						return { kind: 'pattern', message: patternMessage };
					}
					return null;
				});
			}
		}
	}
}

// ─── Internal helpers ───────────────────────────────────────────────

function getTypeDefault(type: FormFieldConfig['type']): unknown {
	switch (type) {
		case 'checkbox':
			return false;
		case 'number':
			return null;
		default:
			return '';
	}
}

function applyTextValidators(field: FormFieldConfig, fieldPath: unknown, label: string): void {
	if (field.minLength != null) {
		minLength(fieldPath as SchemaPath<string>, field.minLength, {
			message: `${label} must be at least ${field.minLength} characters`,
		});
	}
	if (field.maxLength != null) {
		maxLength(fieldPath as SchemaPath<string>, field.maxLength, {
			message: `${label} must be no more than ${field.maxLength} characters`,
		});
	}
}

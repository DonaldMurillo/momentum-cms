/**
 * Entity Form Widget Types
 *
 * Types for the entity form widget that handles create/edit operations.
 */

import type { Field, CollectionConfig } from '@momentum-cms/core';
import { flattenDataFields } from '@momentum-cms/core';
import type { Entity } from '../widget.types';

/**
 * Form mode - create, edit, or view.
 */
export type EntityFormMode = 'create' | 'edit' | 'view';

/**
 * Field error state.
 */
export interface FieldError {
	/** Field name */
	field: string;
	/** Error message */
	message: string;
}

/**
 * Form state.
 */
export interface EntityFormState<T = Entity> {
	/** Current form data */
	data: Partial<T>;
	/** Original data (for edit mode) */
	originalData: T | null;
	/** Whether the form has unsaved changes */
	isDirty: boolean;
	/** Whether the form is being submitted */
	isSubmitting: boolean;
	/** Whether the form is loading data (edit mode) */
	isLoading: boolean;
	/** Field-level errors */
	errors: FieldError[];
	/** General form error */
	formError: string | null;
}

/**
 * Field renderer context.
 */
export interface FieldRendererContext<T = Entity> {
	/** Field definition */
	field: Field;
	/** Current field value */
	value: unknown;
	/** Form mode */
	mode: EntityFormMode;
	/** Collection configuration */
	collection: CollectionConfig;
	/** Full form data */
	formData: Partial<T>;
	/** Field path (for nested fields) */
	path: string;
	/** Whether the field is disabled */
	disabled: boolean;
	/** Field error (if any) */
	error?: string;
}

/**
 * Field change event.
 */
export interface FieldChangeEvent {
	/** Field path */
	path: string;
	/** New value */
	value: unknown;
}

/**
 * Form save result.
 */
export interface EntityFormSaveResult<T = Entity> {
	/** Whether the save was successful */
	success: boolean;
	/** Saved entity (if successful) */
	entity?: T;
	/** Errors (if failed) */
	errors?: FieldError[];
	/** General error message */
	message?: string;
}

/**
 * Get initial value for a field.
 */
export function getFieldDefaultValue(field: Field): unknown {
	if (field.defaultValue !== undefined) {
		return field.defaultValue;
	}

	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'slug':
			return '';
		case 'number':
			return null;
		case 'checkbox':
			return false;
		case 'select':
			return null;
		case 'date':
			return null;
		case 'relationship':
			return null;
		case 'array':
			return [];
		case 'group':
		case 'json':
			return {};
		default:
			return null;
	}
}

/**
 * Type guard to check if a value is a record object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Create initial form data from collection fields.
 */
export function createInitialFormData(collection: CollectionConfig): Record<string, unknown> {
	const data: Record<string, unknown> = {};

	// Flatten through layout fields (tabs, collapsible, row) to initialize all data fields
	const dataFields = flattenDataFields(collection.fields);
	for (const field of dataFields) {
		data[field.name] = getFieldDefaultValue(field);
	}

	return data;
}

/**
 * Get value at a path in an object.
 */
export function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (isRecord(current)) {
			current = current[part];
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * Set value at a path in an object (immutably).
 */
export function setValueAtPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const parts = path.split('.');
	const result = { ...obj };

	if (parts.length === 1) {
		result[parts[0]] = value;
		return result;
	}

	let current: Record<string, unknown> = result;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const next = current[part];

		if (isRecord(next)) {
			current[part] = { ...next };
		} else {
			current[part] = {};
		}
		const nextCurrent = current[part];
		if (isRecord(nextCurrent)) {
			current = nextCurrent;
		}
	}

	current[parts[parts.length - 1]] = value;
	return result;
}

/**
 * Entity Form Widget Types
 *
 * Types for the entity form widget that handles create/edit operations.
 */

import type { Signal, WritableSignal } from '@angular/core';
import type { Field, CollectionConfig } from '@momentum-cms/core';
import { flattenDataFields } from '@momentum-cms/core';

/**
 * Form mode - create, edit, or view.
 */
export type EntityFormMode = 'create' | 'edit' | 'view';

/**
 * Minimal interface for accessing a FieldState from a signal forms FieldTree node.
 * FieldTree nodes are callable — calling one returns its FieldState.
 */
export interface FieldNodeState {
	readonly value: WritableSignal<unknown>;
	readonly errors: Signal<ReadonlyArray<{ kind: string; message?: string }>>;
	readonly touched: Signal<boolean>;
	readonly dirty: Signal<boolean>;
	readonly invalid: Signal<boolean>;
	markAsTouched(): void;
	reset(value?: unknown): void;
}

/**
 * Safely extract FieldState from an unknown FieldTree node.
 * FieldTree nodes are callable functions — invoking returns the FieldState.
 */
export function getFieldNodeState(formNode: unknown): FieldNodeState | null {
	if (formNode == null || typeof formNode !== 'function') return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return (formNode as () => FieldNodeState)();
}

/**
 * Get a sub-node from a FieldTree node by key (field name or array index).
 */
export function getSubNode(parentNode: unknown, key: string | number): unknown {
	if (parentNode == null) return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return (parentNode as Record<string, unknown>)[String(key)] ?? null;
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
 * Get the best title field name from a collection config.
 * Checks admin.useAsTitle first, then falls back to 'title' or 'name' fields.
 */
export function getTitleField(config: Record<string, unknown>): string {
	const admin = config['admin'];
	if (isRecord(admin) && typeof admin['useAsTitle'] === 'string') {
		return admin['useAsTitle'];
	}

	const fields = config['fields'];
	if (Array.isArray(fields)) {
		for (const field of fields) {
			if (isRecord(field) && typeof field['name'] === 'string') {
				if (field['name'] === 'title' || field['name'] === 'name') {
					return field['name'];
				}
			}
		}
	}

	return 'id';
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

/**
 * Field-Level Access Control
 *
 * Enforces FieldAccessConfig (create/read/update) by filtering
 * fields from request data or response documents based on permissions.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow filtered[field.name] from unknown to Record/array */

import type { Field, FieldAccessConfig, RequestContext } from '@momentum-cms/core';
import { flattenDataFields } from '@momentum-cms/core';

interface FieldAccessArgs {
	req: RequestContext;
	data?: Record<string, unknown>;
	doc?: Record<string, unknown>;
}

/**
 * Check if any fields in the collection have access control defined.
 * Recursively checks through all field nesting (groups, arrays, blocks, layout fields).
 * Used as a fast-path to skip processing when no field access is configured.
 */
export function hasFieldAccessControl(fields: Field[]): boolean {
	for (const field of fields) {
		if (field.access !== undefined) return true;
		if (field.type === 'group' && hasFieldAccessControl(field.fields)) return true;
		if (field.type === 'array' && hasFieldAccessControl(field.fields)) return true;
		if (field.type === 'blocks') {
			for (const block of field.blocks) {
				if (hasFieldAccessControl(block.fields)) return true;
			}
		}
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if (hasFieldAccessControl(tab.fields)) return true;
			}
		}
		if (
			(field.type === 'collapsible' || field.type === 'row') &&
			hasFieldAccessControl(field.fields)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Filter fields the user cannot read from a response document.
 * Returns a new document with restricted fields removed.
 */
export async function filterReadableFields(
	fields: Field[],
	doc: Record<string, unknown>,
	req: RequestContext,
): Promise<Record<string, unknown>> {
	const dataFields = flattenDataFields(fields);
	const filtered = { ...doc };
	const args: FieldAccessArgs = { req, doc };

	for (const field of dataFields) {
		if (field.access?.read) {
			const allowed = await Promise.resolve(field.access.read(args));
			if (!allowed) {
				delete filtered[field.name];
			}
		}

		// Recurse into group fields
		if (
			field.type === 'group' &&
			filtered[field.name] &&
			typeof filtered[field.name] === 'object'
		) {
			filtered[field.name] = await filterReadableFields(
				field.fields,
				filtered[field.name] as Record<string, unknown>,
				req,
			);
		}

		// Recurse into array fields
		if (field.type === 'array' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map((row) => filterReadableFields(field.fields, row, req)),
			);
		}

		// Recurse into blocks fields
		if (field.type === 'blocks' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map(async (row) => {
					const blockType = row['blockType'] as string | undefined;
					if (!blockType) return row;
					const blockConfig = field.blocks.find((b) => b.slug === blockType);
					if (!blockConfig) return row;
					return filterReadableFields(blockConfig.fields, row, req);
				}),
			);
		}
	}

	return filtered;
}

/**
 * Filter fields the user cannot create from input data.
 * Returns a new data object with restricted fields removed.
 */
export async function filterCreatableFields(
	fields: Field[],
	data: Record<string, unknown>,
	req: RequestContext,
): Promise<Record<string, unknown>> {
	return filterWritableFields(fields, data, req, 'create');
}

/**
 * Filter fields the user cannot update from input data.
 * Returns a new data object with restricted fields removed.
 */
export async function filterUpdatableFields(
	fields: Field[],
	data: Record<string, unknown>,
	req: RequestContext,
): Promise<Record<string, unknown>> {
	return filterWritableFields(fields, data, req, 'update');
}

async function filterWritableFields(
	fields: Field[],
	data: Record<string, unknown>,
	req: RequestContext,
	operation: 'create' | 'update',
): Promise<Record<string, unknown>> {
	const dataFields = flattenDataFields(fields);
	const filtered = { ...data };
	const accessKey: keyof FieldAccessConfig = operation;
	const args: FieldAccessArgs = { req, data };

	for (const field of dataFields) {
		const accessFn = field.access?.[accessKey];
		if (accessFn) {
			const allowed = await Promise.resolve(accessFn(args));
			if (!allowed) {
				delete filtered[field.name];
			}
		}

		// Recurse into group fields
		if (
			field.type === 'group' &&
			filtered[field.name] &&
			typeof filtered[field.name] === 'object'
		) {
			filtered[field.name] = await filterWritableFields(
				field.fields,
				filtered[field.name] as Record<string, unknown>,
				req,
				operation,
			);
		}

		// Recurse into array fields
		if (field.type === 'array' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map((row) => filterWritableFields(field.fields, row, req, operation)),
			);
		}

		// Recurse into blocks fields
		if (field.type === 'blocks' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map(async (row) => {
					const blockType = row['blockType'] as string | undefined;
					if (!blockType) return row;
					const blockConfig = field.blocks.find((b) => b.slug === blockType);
					if (!blockConfig) return row;
					return filterWritableFields(blockConfig.fields, row, req, operation);
				}),
			);
		}
	}

	return filtered;
}

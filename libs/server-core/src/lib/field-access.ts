/**
 * Field-Level Access Control
 *
 * Enforces FieldAccessConfig (create/read/update) by filtering
 * fields from request data or response documents based on permissions.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow filtered[field.name] from unknown to Record/array */

import type { Field, FieldAccessConfig, RequestContext } from '@momentumcms/core';
import { flattenDataFields } from '@momentumcms/core';
import { ValidationError } from './momentum-api.types';

/** Maximum nesting depth for field access recursion (groups, arrays, blocks, tabs). */
const MAX_FIELD_ACCESS_DEPTH = 10;

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
export function hasFieldAccessControl(fields: Field[], _depth = 0): boolean {
	// On depth overflow, return false. If no real access control was found
	// before hitting the depth limit, there's nothing to filter. The filter
	// functions have their own depth guards that throw ValidationError when
	// actual access control processing overflows — but only for collections
	// that have real access control configured (which means this function
	// would have returned true before reaching this branch).
	if (_depth > MAX_FIELD_ACCESS_DEPTH) return false;

	for (const field of fields) {
		if (field.access !== undefined) return true;
		if (field.type === 'group' && hasFieldAccessControl(field.fields, _depth + 1)) return true;
		if (field.type === 'array' && hasFieldAccessControl(field.fields, _depth + 1)) return true;
		if (field.type === 'blocks') {
			for (const block of field.blocks) {
				if (hasFieldAccessControl(block.fields, _depth + 1)) return true;
			}
		}
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if (hasFieldAccessControl(tab.fields, _depth + 1)) return true;
			}
		}
		if (
			(field.type === 'collapsible' || field.type === 'row') &&
			hasFieldAccessControl(field.fields, _depth + 1)
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
	_depth = 0,
): Promise<Record<string, unknown>> {
	// SECURITY: On depth overflow, throw ValidationError to prevent silent data loss.
	// Previously returned {} which silently emptied payloads on writes and stripped
	// all fields on reads. Throwing makes the depth limit visible to callers.
	if (_depth > MAX_FIELD_ACCESS_DEPTH) {
		throw new ValidationError([
			{
				field: 'root',
				message: `Field nesting depth exceeds maximum of ${MAX_FIELD_ACCESS_DEPTH} levels`,
			},
		]);
	}

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
				_depth + 1,
			);
		}

		// Recurse into array fields
		if (field.type === 'array' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map((row) => filterReadableFields(field.fields, row, req, _depth + 1)),
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
					return filterReadableFields(blockConfig.fields, row, req, _depth + 1);
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
	_depth = 0,
): Promise<Record<string, unknown>> {
	// SECURITY: On depth overflow, throw ValidationError to prevent silent data loss.
	// Previously returned {} which silently emptied payloads on writes and stripped
	// all fields on reads. Throwing makes the depth limit visible to callers.
	if (_depth > MAX_FIELD_ACCESS_DEPTH) {
		throw new ValidationError([
			{
				field: 'root',
				message: `Field nesting depth exceeds maximum of ${MAX_FIELD_ACCESS_DEPTH} levels`,
			},
		]);
	}

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
				_depth + 1,
			);
		}

		// Recurse into array fields
		if (field.type === 'array' && Array.isArray(filtered[field.name])) {
			const rows = filtered[field.name] as Record<string, unknown>[];
			filtered[field.name] = await Promise.all(
				rows.map((row) => filterWritableFields(field.fields, row, req, operation, _depth + 1)),
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
					return filterWritableFields(blockConfig.fields, row, req, operation, _depth + 1);
				}),
			);
		}
	}

	return filtered;
}

/**
 * Field-Level Hook Execution
 *
 * Runs FieldHooksConfig (beforeValidate/beforeChange/afterChange/afterRead)
 * for each field that has hooks defined.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow processedData[field.name] from unknown to Record/array */

import type { Field, FieldHookFunction, RequestContext } from '@momentumcms/core';
import { isNamedTab } from '@momentumcms/core';

type FieldHookType = 'beforeValidate' | 'beforeChange' | 'afterChange' | 'afterRead';

/**
 * Check if any fields in the collection have hooks defined.
 * Recursively checks through all field nesting (groups, arrays, blocks, layout fields).
 */
export function hasFieldHooks(fields: Field[]): boolean {
	for (const field of fields) {
		if (field.hooks !== undefined) return true;
		if (field.type === 'group' && hasFieldHooks(field.fields)) return true;
		if (field.type === 'array' && hasFieldHooks(field.fields)) return true;
		if (field.type === 'blocks') {
			for (const block of field.blocks) {
				if (hasFieldHooks(block.fields)) return true;
			}
		}
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if (hasFieldHooks(tab.fields)) return true;
			}
		}
		if ((field.type === 'collapsible' || field.type === 'row') && hasFieldHooks(field.fields)) {
			return true;
		}
	}
	return false;
}

/**
 * Run field-level hooks for a specific hook type.
 * Iterates through all fields and runs matching hooks, allowing each to transform the field value.
 * Recurses into groups, arrays, blocks, and layout fields.
 * Returns the data with any transformed values.
 */
export async function runFieldHooks(
	hookType: FieldHookType,
	fields: Field[],
	data: Record<string, unknown>,
	req: RequestContext,
	operation: 'create' | 'update' | 'read',
): Promise<Record<string, unknown>> {
	let processedData = { ...data };

	for (const field of fields) {
		// Layout fields (tabs, collapsible, row) don't store data themselves.
		// Their children's data lives at the same level, so recurse into them.
		// Named tabs are an exception: they store nested data (like groups).
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if (isNamedTab(tab)) {
					// Named tab: recurse into nested data (like a group)
					const nested = processedData[tab.name];
					if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
						processedData[tab.name] = await runFieldHooks(
							hookType,
							tab.fields,
							nested as Record<string, unknown>,
							req,
							operation,
						);
					}
				} else {
					// Unnamed tab: fields live at same level (layout-only)
					processedData = await runFieldHooks(hookType, tab.fields, processedData, req, operation);
				}
			}
			continue;
		}
		if (field.type === 'collapsible' || field.type === 'row') {
			processedData = await runFieldHooks(hookType, field.fields, processedData, req, operation);
			continue;
		}

		// Run hooks on this field if it has any for this hook type
		const hooks: FieldHookFunction[] | undefined = field.hooks?.[hookType];
		if (hooks && hooks.length > 0) {
			const fieldExistsInData = field.name in processedData;
			let value = processedData[field.name];

			for (const hook of hooks) {
				const result = await Promise.resolve(
					hook({
						value,
						data: processedData,
						req,
						operation,
					}),
				);

				if (result !== undefined) {
					value = result;
				}
			}

			// Only set the field if it was already in the data or a hook produced a value.
			// This prevents hooks from injecting undefined/null for fields not in a PATCH payload.
			if (fieldExistsInData || value !== undefined) {
				processedData[field.name] = value;
			}
		}

		// Recurse into group fields (child data is nested under field.name)
		if (
			field.type === 'group' &&
			processedData[field.name] &&
			typeof processedData[field.name] === 'object' &&
			!Array.isArray(processedData[field.name])
		) {
			processedData[field.name] = await runFieldHooks(
				hookType,
				field.fields,
				processedData[field.name] as Record<string, unknown>,
				req,
				operation,
			);
		}

		// Recurse into array fields (each row contains child data)
		if (field.type === 'array' && Array.isArray(processedData[field.name])) {
			const rows = processedData[field.name] as Record<string, unknown>[];
			processedData[field.name] = await Promise.all(
				rows.map((row) => runFieldHooks(hookType, field.fields, row, req, operation)),
			);
		}

		// Recurse into blocks fields (each block has blockType + child data)
		if (field.type === 'blocks' && Array.isArray(processedData[field.name])) {
			const blockRows = processedData[field.name] as Record<string, unknown>[];
			const blockMap = new Map(field.blocks.map((b) => [b.slug, b]));
			processedData[field.name] = await Promise.all(
				blockRows.map(async (row) => {
					const blockConfig = blockMap.get(row['blockType'] as string);
					if (blockConfig) {
						return runFieldHooks(hookType, blockConfig.fields, row, req, operation);
					}
					return row;
				}),
			);
		}
	}

	return processedData;
}

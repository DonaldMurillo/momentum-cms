/**
 * Block Field Injector
 *
 * Walks all collections and injects `_analytics` group fields into every
 * BlockConfig, giving admins per-block-instance control over impression
 * and hover tracking.
 *
 * Same mutation pattern as `injectCollectionCollector` — modifies the
 * mutable collections array during plugin `onInit`.
 */

import type { CollectionConfig, Field, GroupField } from '@momentumcms/core';
import { group, checkbox } from '@momentumcms/core';

/**
 * Create the `_analytics` group field injected into each block definition.
 */
function createAnalyticsGroupField(): GroupField {
	return group('_analytics', {
		label: 'Analytics',
		admin: { collapsible: true, defaultOpen: false },
		fields: [
			checkbox('trackImpressions', { label: 'Track Impressions' }),
			checkbox('trackHover', { label: 'Track Hover' }),
		],
	});
}

/**
 * Check if a field already has an `_analytics` group injected (idempotency).
 */
function hasAnalyticsField(fields: Field[]): boolean {
	return fields.some((f) => f.name === '_analytics' && f.type === 'group');
}

/**
 * Type guard: field has a `blocks` array (BlocksField).
 */
function hasBlocks(field: Field): field is Field & { blocks: Array<{ fields: Field[] }> } {
	return field.type === 'blocks' && 'blocks' in field;
}

/**
 * Type guard: field has nested `fields` (group, array, collapsible, row).
 */
function hasNestedFields(field: Field): field is Field & { fields: Field[] } {
	return 'fields' in field && Array.isArray(field.fields);
}

/**
 * Type guard: field has `tabs` array (tabs field).
 */
function hasTabs(field: Field): field is Field & { tabs: Array<{ fields: Field[] }> } {
	return field.type === 'tabs' && 'tabs' in field;
}

/**
 * Recursively find all BlocksField instances in a field tree and inject
 * analytics fields into each BlockConfig.
 *
 * Handles nesting through groups, arrays, tabs, collapsibles, and rows.
 */
function injectIntoFields(fields: Field[]): void {
	for (const field of fields) {
		if (hasBlocks(field)) {
			for (const blockConfig of field.blocks) {
				if (!hasAnalyticsField(blockConfig.fields)) {
					blockConfig.fields.push(createAnalyticsGroupField());
				}
			}
		}

		// Recurse into container field types
		if (
			(field.type === 'group' ||
				field.type === 'array' ||
				field.type === 'collapsible' ||
				field.type === 'row') &&
			hasNestedFields(field)
		) {
			injectIntoFields(field.fields);
		}

		if (hasTabs(field)) {
			for (const tab of field.tabs) {
				injectIntoFields(tab.fields);
			}
		}
	}
}

/**
 * Inject analytics group fields into all block definitions across all collections.
 *
 * @param collections - Mutable collections array from PluginContext
 */
export function injectBlockAnalyticsFields(collections: CollectionConfig[]): void {
	for (const collection of collections) {
		injectIntoFields(collection.fields);
	}
}

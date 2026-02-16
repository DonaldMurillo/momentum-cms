/**
 * Entity List Widget Types
 *
 * Types for the entity list widget that displays collection data.
 */

import type { DataTableColumn, DataTableRowAction } from '@momentumcms/ui';
import type { Entity, EntityAction } from '../widget.types';

/**
 * Column configuration for entity list.
 * Extends DataTableColumn with collection-specific options.
 */
export interface EntityListColumn<T = Entity> extends DataTableColumn<T> {
	/** Field type for automatic formatting */
	type?:
		| 'text'
		| 'number'
		| 'date'
		| 'datetime'
		| 'boolean'
		| 'badge'
		| 'relationship'
		| 'array'
		| 'group'
		| 'json';
	/** Badge variant for 'badge' type columns */
	badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
	/** Badge color mapping for 'badge' type columns */
	badgeMap?: Record<
		string,
		{ label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
	>;
}

/**
 * Event emitted when an entity action is triggered.
 */
export interface EntityListActionEvent<T = Entity> {
	/** The action that was triggered */
	action: EntityAction;
	/** The entity the action was triggered on */
	entity: T;
}

/**
 * Event emitted when a bulk action is triggered.
 */
export interface EntityListBulkActionEvent<T = Entity> {
	/** The action that was triggered */
	action: EntityAction;
	/** The entities the action was triggered on */
	entities: T[];
}

/**
 * Result of a find operation.
 */
export interface EntityListFindResult<T = Entity> {
	docs: T[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

/**
 * Default field to column type mapping.
 */
export const FIELD_TYPE_TO_COLUMN_TYPE: Record<string, EntityListColumn['type']> = {
	text: 'text',
	textarea: 'text',
	richText: 'text',
	email: 'text',
	slug: 'text',
	number: 'number',
	checkbox: 'boolean',
	date: 'date',
	select: 'badge',
	relationship: 'relationship',
	array: 'array',
	group: 'group',
	json: 'json',
};

/**
 * Maps row actions from EntityAction to DataTableRowAction.
 */
export function mapEntityActionsToRowActions<T = Entity>(
	actions: EntityAction[],
): DataTableRowAction<T>[] {
	return actions.map((action) => {
		const isDisabled = action.disabled;
		return {
			id: action.id,
			label: action.label,
			icon: action.icon,
			variant: action.variant === 'destructive' ? 'destructive' : 'default',
			disabled: isDisabled !== undefined ? () => isDisabled : undefined,
		};
	});
}

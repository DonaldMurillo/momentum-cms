import type { Entity, EntityAction } from '../widget.types';

/**
 * Field display configuration for the entity view.
 */
export interface EntityViewFieldConfig {
	/** Field name */
	field: string;
	/** Display label (defaults to field name) */
	label?: string;
	/** Display type override */
	type?:
		| 'text'
		| 'number'
		| 'date'
		| 'datetime'
		| 'boolean'
		| 'badge'
		| 'link'
		| 'email'
		| 'list'
		| 'json'
		| 'html'
		| 'group'
		| 'array-table';
	/** Custom formatter function */
	formatter?: (value: unknown, entity: Entity) => string;
	/** Whether to hide this field */
	hidden?: boolean;
}

/**
 * Breadcrumb item for navigation.
 */
export interface BreadcrumbItem {
	label: string;
	href?: string;
}

/**
 * Entity view action event.
 */
export interface EntityViewActionEvent {
	action: EntityAction;
	entity: Entity;
}

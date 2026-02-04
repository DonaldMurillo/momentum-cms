import type { TemplateRef } from '@angular/core';

/**
 * Column definition for data table.
 */
export interface DataTableColumn<T = unknown> {
	/** Field name from the data object */
	field: keyof T | string;
	/** Display header text */
	header: string;
	/** Whether the column is sortable */
	sortable?: boolean;
	/** Column width (CSS value) */
	width?: string;
	/** Minimum column width (CSS value) - prevents column collapse on narrow screens */
	minWidth?: string;
	/** Text alignment */
	align?: 'left' | 'center' | 'right';
	/** Custom render function for cell value */
	render?: (value: unknown, item: T) => string;
	/** Custom template for cell content */
	template?: TemplateRef<DataTableCellContext<T>>;
}

/**
 * Context provided to column templates.
 */
export interface DataTableCellContext<T> {
	/** The cell value */
	$implicit: unknown;
	/** The full row item */
	item: T;
	/** The column definition */
	column: DataTableColumn<T>;
	/** Row index */
	index: number;
}

/**
 * Sort state for the data table.
 */
export interface DataTableSort<T = unknown> {
	/** Field being sorted */
	field: keyof T | string;
	/** Sort direction */
	direction: 'asc' | 'desc';
}

/**
 * Row action definition.
 */
export interface DataTableRowAction<T = unknown> {
	/** Action identifier */
	id: string;
	/** Display label */
	label: string;
	/** Optional icon */
	icon?: string;
	/** Action handler */
	handler?: (item: T) => void;
	/** Whether the action is visible for an item */
	visible?: (item: T) => boolean;
	/** Whether the action is disabled for an item */
	disabled?: (item: T) => boolean;
	/** Button variant */
	variant?: 'default' | 'destructive' | 'ghost';
}

/**
 * Event emitted when a row action is triggered.
 */
export interface DataTableRowActionEvent<T> {
	/** The action that was triggered */
	action: DataTableRowAction<T>;
	/** The item the action was triggered on */
	item: T;
}

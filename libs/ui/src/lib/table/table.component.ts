import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Grid } from '@angular/aria/grid';
import type { TableFocusMode, TableSelectionMode, TableWrapMode } from './table.types';

/**
 * Table component with keyboard navigation and selection support.
 *
 * @example
 * ```html
 * <mcms-table>
 *   <mcms-table-header>
 *     <mcms-table-row>
 *       <mcms-table-head>Name</mcms-table-head>
 *       <mcms-table-head>Status</mcms-table-head>
 *     </mcms-table-row>
 *   </mcms-table-header>
 *   <mcms-table-body>
 *     <mcms-table-row>
 *       <mcms-table-cell>John</mcms-table-cell>
 *       <mcms-table-cell>Active</mcms-table-cell>
 *     </mcms-table-row>
 *   </mcms-table-body>
 * </mcms-table>
 * ```
 */
@Component({
	selector: 'mcms-table',
	hostDirectives: [
		{
			directive: Grid,
			inputs: [
				'enableSelection',
				'disabled',
				'focusMode',
				'rowWrap',
				'colWrap',
				'multi',
				'selectionMode',
				'enableRangeSelection',
			],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'grid',
	},
	template: `
		<table role="none" [class]="tableClasses()">
			<ng-content />
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Table {
	/** Whether selection is enabled. */
	readonly enableSelection = input(false);

	/** Whether the table is disabled. */
	readonly disabled = input(false);

	/** Focus mode for keyboard navigation. */
	readonly focusMode = input<TableFocusMode>('roving');

	/** Row wrap behavior. */
	readonly rowWrap = input<TableWrapMode>('nowrap');

	/** Column wrap behavior. */
	readonly colWrap = input<TableWrapMode>('nowrap');

	/** Whether multiple cells can be selected. */
	readonly multi = input(false);

	/** Selection mode. */
	readonly selectionMode = input<TableSelectionMode>('explicit');

	/** Whether range selection is enabled. */
	readonly enableRangeSelection = input(false);

	/** Additional CSS classes for the wrapper. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `relative w-full overflow-auto ${this.class()}`.trim();
	});

	readonly tableClasses = computed(() => {
		return 'w-full caption-bottom text-sm';
	});
}

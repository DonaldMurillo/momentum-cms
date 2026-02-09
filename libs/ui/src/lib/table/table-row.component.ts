import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GridRow } from '@angular/aria/grid';

/**
 * Table row (tr) component with keyboard navigation support.
 *
 * @example
 * ```html
 * <mcms-table-row>
 *   <mcms-table-cell>Cell 1</mcms-table-cell>
 *   <mcms-table-cell>Cell 2</mcms-table-cell>
 * </mcms-table-row>
 * ```
 */
@Component({
	selector: 'mcms-table-row',
	hostDirectives: [
		{
			directive: GridRow,
			inputs: ['rowIndex'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'row',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: table-row;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableRow {
	/** The row index within the grid. */
	readonly rowIndex = input<number>();

	/** Whether this row is selected. */
	readonly selected = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'border-b transition-colors hover:bg-muted/50';
		const selectedClasses = this.selected() ? 'bg-muted' : '';

		return `${base} ${selectedClasses} ${this.class()}`.trim();
	});
}

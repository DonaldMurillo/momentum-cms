import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { GridCell } from '@angular/aria/grid';

/**
 * Table data cell (td) component with selection support.
 *
 * @example
 * ```html
 * <mcms-table-cell>Cell content</mcms-table-cell>
 * ```
 */
@Component({
	selector: 'mcms-table-cell',
	hostDirectives: [
		{
			directive: GridCell,
			inputs: ['disabled', 'selected', 'colSpan', 'rowSpan'],
			outputs: ['selectedChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'gridcell',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: table-cell;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableCell {
	/** Whether this cell is disabled. */
	readonly disabled = input(false);

	/** Whether this cell is selected. */
	readonly selected = model(false);

	/** Number of columns to span. */
	readonly colSpan = input(1);

	/** Number of rows to span. */
	readonly rowSpan = input(1);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		/* Generous vertical padding so rows breathe; horizontal stays tight so columns
		 * don't drift apart. Selected rows pick up a soft brand tint. */
		const base =
			'px-3 py-3.5 align-middle text-sm [&:has([role=checkbox])]:pr-0 [&>mcms-checkbox]:translate-y-[2px]';
		const selectedClasses = this.selected() ? 'bg-primary/10' : '';

		return `${base} ${selectedClasses} ${this.class()}`.trim();
	});
}

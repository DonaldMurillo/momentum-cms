import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GridCell } from '@angular/aria/grid';

/**
 * Table header cell (th) component.
 *
 * Usage: Provide role="columnheader" when using in table headers.
 *
 * @example
 * ```html
 * <mcms-table-head role="columnheader">Column Name</mcms-table-head>
 * ```
 */
@Component({
	selector: 'mcms-table-head',
	hostDirectives: [
		{
			directive: GridCell,
			inputs: ['disabled', 'colSpan', 'rowSpan', 'role'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: table-cell;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHead {
	/** Whether this column is disabled. */
	readonly disabled = input(false);

	/** Number of columns to span. */
	readonly colSpan = input(1);

	/** Number of rows to span. */
	readonly rowSpan = input(1);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base =
			'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]';

		return `${base} ${this.class()}`.trim();
	});
}

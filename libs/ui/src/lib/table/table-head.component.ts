import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GridCell } from '@angular/aria/grid';

/**
 * Table header cell (th) component.
 *
 * GridCell manages the `role` attribute imperatively. Pass `role="columnheader"`
 * when used inside `<mcms-table-header>` for correct ARIA semantics.
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
		/* Editorial header — short uppercase eyebrow, lots of tracking, low weight.
		 * Reads as labels rather than as "click-to-sort" buttons. */
		const base =
			'h-8 px-3 text-left align-middle text-2xs font-semibold uppercase tracking-mcms-wider text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>mcms-checkbox]:translate-y-[2px]';

		return `${base} ${this.class()}`.trim();
	});
}

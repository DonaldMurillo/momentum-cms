import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Table body (tbody) component.
 *
 * @example
 * ```html
 * <mcms-table-body>
 *   <mcms-table-row>
 *     <mcms-table-cell>Cell content</mcms-table-cell>
 *   </mcms-table-row>
 * </mcms-table-body>
 * ```
 */
@Component({
	selector: 'mcms-table-body',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableBody {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `[&_tr:last-child]:border-0 ${this.class()}`.trim();
	});
}

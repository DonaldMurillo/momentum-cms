import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Table footer (tfoot) component.
 *
 * @example
 * ```html
 * <mcms-table-footer>
 *   <mcms-table-row>
 *     <mcms-table-cell>Total</mcms-table-cell>
 *     <mcms-table-cell>$1,000</mcms-table-cell>
 *   </mcms-table-row>
 * </mcms-table-footer>
 * ```
 */
@Component({
	selector: 'mcms-table-footer',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableFooter {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `border-t bg-muted/50 font-medium [&>tr]:last:border-b-0 ${this.class()}`.trim();
	});
}

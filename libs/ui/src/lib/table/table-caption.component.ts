import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Table caption component.
 *
 * @example
 * ```html
 * <mcms-table>
 *   <mcms-table-caption>List of users</mcms-table-caption>
 *   <!-- ... -->
 * </mcms-table>
 * ```
 */
@Component({
	selector: 'mcms-table-caption',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: table-caption;
			caption-side: bottom;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableCaption {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `mt-4 text-sm text-muted-foreground ${this.class()}`.trim();
	});
}

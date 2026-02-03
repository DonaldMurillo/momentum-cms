import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Table header (thead) component.
 *
 * @example
 * ```html
 * <mcms-table-header>
 *   <mcms-table-row>
 *     <mcms-table-head>Column 1</mcms-table-head>
 *   </mcms-table-row>
 * </mcms-table-header>
 * ```
 */
@Component({
	selector: 'mcms-table-header, thead[mcms-table-header]',
	host: {
		'[class]': 'hostClasses()',
		'[style.display]': '"table-header-group"',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: table-header-group;
		}
		:host ::ng-deep mcms-table-row {
			border-bottom: 1px solid hsl(var(--mcms-border));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHeader {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `[&_tr]:border-b ${this.class()}`.trim();
	});
}

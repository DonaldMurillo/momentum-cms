import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Displayed when there are no results in the command list.
 *
 * @example
 * ```html
 * <mcms-command-empty>No results found.</mcms-command-empty>
 * ```
 */
@Component({
	selector: 'mcms-command-empty',
	host: {
		'[class]': 'hostClasses()',
		role: 'status',
		'aria-live': 'polite',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandEmpty {
	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'py-6 text-center text-sm text-muted-foreground';
		return `${base} ${this.class()}`.trim();
	});
}

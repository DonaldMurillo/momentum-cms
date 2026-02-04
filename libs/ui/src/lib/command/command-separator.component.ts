import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A visual separator between command groups or items.
 *
 * @example
 * ```html
 * <mcms-command-group label="Navigation">...</mcms-command-group>
 * <mcms-command-separator />
 * <mcms-command-group label="Settings">...</mcms-command-group>
 * ```
 */
@Component({
	selector: 'mcms-command-separator',
	host: {
		'[class]': 'hostClasses()',
		role: 'separator',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandSeparator {
	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = '-mx-1 my-1 block h-px bg-border';
		return `${base} ${this.class()}`.trim();
	});
}

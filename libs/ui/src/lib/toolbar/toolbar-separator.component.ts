import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Visual separator between toolbar widgets.
 *
 * @example
 * ```html
 * <button mcms-toolbar-widget value="bold">Bold</button>
 * <mcms-toolbar-separator />
 * <button mcms-toolbar-widget value="link">Link</button>
 * ```
 */
@Component({
	selector: 'mcms-toolbar-separator',
	host: {
		'[class]': 'hostClasses()',
		role: 'separator',
		'aria-orientation': 'vertical',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarSeparator {
	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'mx-1 h-5 w-px bg-border';
		return `${base} ${this.class()}`.trim();
	});
}

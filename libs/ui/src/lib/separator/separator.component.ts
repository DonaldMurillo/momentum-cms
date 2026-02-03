import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A visual separator for dividing content.
 *
 * @example
 * ```html
 * <mcms-separator />
 * <mcms-separator orientation="vertical" />
 * <mcms-separator [decorative]="false" />
 * ```
 */
@Component({
	selector: 'mcms-separator',
	host: {
		'[class]': 'hostClasses()',
		'[attr.role]': 'role()',
		'[attr.aria-orientation]': 'ariaOrientation()',
	},
	template: '',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Separator {
	/** Orientation of the separator. */
	readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

	/** Whether the separator is purely decorative (no semantic meaning). */
	readonly decorative = input(true);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly role = computed(() => (this.decorative() ? 'none' : 'separator'));

	readonly ariaOrientation = computed(() => (this.decorative() ? undefined : this.orientation()));

	readonly hostClasses = computed(() => {
		const base = 'shrink-0 bg-border';
		const orientationClasses = this.orientation() === 'horizontal' ? 'h-px w-full' : 'h-full w-px';

		return `${base} ${orientationClasses} ${this.class()}`.trim();
	});
}

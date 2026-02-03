import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A skeleton loading placeholder.
 *
 * @example
 * ```html
 * <mcms-skeleton class="h-4 w-[200px]" />
 * <mcms-skeleton class="h-12 w-12 rounded-full" />
 * <mcms-skeleton class="h-32 w-full" />
 * ```
 */
@Component({
	selector: 'mcms-skeleton',
	host: {
		'[class]': 'hostClasses()',
		'aria-hidden': 'true',
	},
	template: '',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
	/** Additional CSS classes for sizing and shape. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `block animate-pulse rounded-md bg-muted ${this.class()}`.trim();
	});
}

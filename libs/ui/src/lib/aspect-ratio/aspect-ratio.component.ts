import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A container that maintains a specific aspect ratio.
 *
 * @example
 * ```html
 * <mcms-aspect-ratio [ratio]="16 / 9">
 *   <img src="image.jpg" class="object-cover w-full h-full" />
 * </mcms-aspect-ratio>
 *
 * <mcms-aspect-ratio [ratio]="1">
 *   <!-- Square content -->
 * </mcms-aspect-ratio>
 * ```
 */
@Component({
	selector: 'mcms-aspect-ratio',
	host: {
		'[class]': 'hostClasses()',
		'[style.aspect-ratio]': 'ratio()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AspectRatio {
	/** Aspect ratio as width / height (e.g., 16/9, 4/3, 1). */
	readonly ratio = input(16 / 9);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `relative block w-full ${this.class()}`.trim();
	});
}

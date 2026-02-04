import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SpinnerSize } from './spinner.types';
import { SPINNER_SIZES } from './spinner.types';

/**
 * A loading spinner indicator.
 *
 * @example
 * ```html
 * <mcms-spinner />
 * <mcms-spinner size="sm" />
 * <mcms-spinner size="lg" />
 * ```
 */
@Component({
	selector: 'mcms-spinner',
	host: {
		'[class]': 'hostClasses()',
		role: 'status',
		'[attr.aria-label]': 'label()',
	},
	template: `
		<svg
			[attr.width]="dimensions().width"
			[attr.height]="dimensions().height"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="animate-spin"
		>
			<circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				[attr.stroke-width]="dimensions().stroke"
				stroke-opacity="0.25"
			/>
			<path
				d="M12 2a10 10 0 0 1 10 10"
				stroke="currentColor"
				[attr.stroke-width]="dimensions().stroke"
				stroke-linecap="round"
			/>
		</svg>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner {
	/** Size of the spinner. */
	readonly size = input<SpinnerSize>('md');

	/** Accessible label for screen readers. */
	readonly label = input('Loading');

	/** Additional CSS classes. */
	readonly class = input('');

	readonly dimensions = computed(() => SPINNER_SIZES[this.size()]);

	readonly hostClasses = computed(() => {
		return `inline-flex items-center justify-center text-primary ${this.class()}`.trim();
	});
}

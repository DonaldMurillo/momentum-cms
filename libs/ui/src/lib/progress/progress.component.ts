import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A progress bar indicator.
 *
 * @example
 * ```html
 * <mcms-progress [value]="50" />
 * <mcms-progress [value]="75" [max]="100" />
 * <mcms-progress />  <!-- indeterminate -->
 * ```
 */
@Component({
	selector: 'mcms-progress',
	host: {
		'[class]': 'hostClasses()',
		role: 'progressbar',
		'[attr.aria-valuenow]': 'value()',
		'[attr.aria-valuemin]': '0',
		'[attr.aria-valuemax]': 'max()',
	},
	template: `
		<div
			class="h-full bg-primary transition-all duration-300"
			[class.animate-progress-indeterminate]="isIndeterminate()"
			[style.width]="progressWidth()"
		></div>
	`,
	styles: `
		@keyframes progress-indeterminate {
			0% {
				transform: translateX(-100%);
			}
			100% {
				transform: translateX(400%);
			}
		}

		.animate-progress-indeterminate {
			width: 25% !important;
			animation: progress-indeterminate 1.5s ease-in-out infinite;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress {
	/** Current progress value. Null for indeterminate state. */
	readonly value = input<number | null>(null);

	/** Maximum value. */
	readonly max = input(100);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly isIndeterminate = computed(() => this.value() === null);

	readonly progressWidth = computed(() => {
		const val = this.value();
		if (val === null) return '0%';
		const percentage = Math.min(100, Math.max(0, (val / this.max()) * 100));
		return `${percentage}%`;
	});

	readonly hostClasses = computed(() => {
		return `relative block h-2 w-full overflow-hidden rounded-full bg-muted ${this.class()}`.trim();
	});
}

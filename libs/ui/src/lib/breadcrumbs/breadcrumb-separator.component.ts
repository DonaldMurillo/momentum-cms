import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Breadcrumb separator between items.
 *
 * @example
 * ```html
 * <mcms-breadcrumb-separator />
 * <mcms-breadcrumb-separator>/</mcms-breadcrumb-separator>
 * ```
 */
@Component({
	selector: 'mcms-breadcrumb-separator',
	host: {
		'[class]': 'hostClasses()',
		role: 'presentation',
		'aria-hidden': 'true',
	},
	template: `
		<ng-content>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</ng-content>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbSeparator {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `[&>svg]:h-3.5 [&>svg]:w-3.5 ${this.class()}`.trim();
	});
}

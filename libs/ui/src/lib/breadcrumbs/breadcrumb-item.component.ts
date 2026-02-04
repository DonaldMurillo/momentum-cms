import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Individual breadcrumb item.
 *
 * @example
 * ```html
 * <mcms-breadcrumb-item href="/products">Products</mcms-breadcrumb-item>
 * <mcms-breadcrumb-item [current]="true">Details</mcms-breadcrumb-item>
 * ```
 */
@Component({
	selector: 'mcms-breadcrumb-item',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		@if (href() && !current()) {
			<a [href]="href()" class="transition-colors hover:text-foreground">
				<ng-content />
			</a>
		} @else {
			<span
				[attr.aria-current]="current() ? 'page' : null"
				[class.font-medium]="current()"
				[class.text-foreground]="current()"
			>
				<ng-content />
			</span>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbItem {
	/** Link href for navigation. */
	readonly href = input<string>();

	/** Whether this is the current/active page. */
	readonly current = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `inline-flex items-center ${this.class()}`.trim();
	});
}

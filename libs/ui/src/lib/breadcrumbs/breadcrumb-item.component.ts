import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

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
	imports: [RouterLink, NgTemplateOutlet],
	host: {
		'[class]': 'hostClasses()',
		role: 'listitem',
	},
	template: `
		<ng-template #content><ng-content /></ng-template>

		@if (href() && !current()) {
			<a
				[routerLink]="href()"
				class="text-muted-foreground transition-colors hover:text-foreground"
			>
				<ng-container *ngTemplateOutlet="content" />
			</a>
		} @else {
			<span
				[attr.aria-current]="current() ? 'page' : null"
				[class.font-medium]="current()"
				[class.text-foreground]="current()"
			>
				<ng-container *ngTemplateOutlet="content" />
			</span>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbItem {
	/** Link href for navigation (uses routerLink for SPA navigation). */
	readonly href = input<string>();

	/** Whether this is the current/active page. */
	readonly current = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `inline-flex items-center ${this.class()}`.trim();
	});
}

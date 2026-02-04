import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Breadcrumbs navigation container.
 *
 * @example
 * ```html
 * <mcms-breadcrumbs>
 *   <mcms-breadcrumb-item href="/">Home</mcms-breadcrumb-item>
 *   <mcms-breadcrumb-separator />
 *   <mcms-breadcrumb-item href="/products">Products</mcms-breadcrumb-item>
 *   <mcms-breadcrumb-separator />
 *   <mcms-breadcrumb-item [current]="true">Details</mcms-breadcrumb-item>
 * </mcms-breadcrumbs>
 * ```
 */
@Component({
	selector: 'mcms-breadcrumbs',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<nav aria-label="Breadcrumb">
			<ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
				<ng-content />
			</ol>
		</nav>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumbs {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `block ${this.class()}`.trim();
	});
}

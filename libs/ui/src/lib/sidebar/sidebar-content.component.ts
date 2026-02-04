import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Main content area of the sidebar, typically for navigation items.
 * This section is scrollable when content overflows.
 *
 * @example
 * ```html
 * <mcms-sidebar-content>
 *   <mcms-sidebar-nav>
 *     <mcms-sidebar-nav-item label="Home" href="/" />
 *   </mcms-sidebar-nav>
 * </mcms-sidebar-content>
 * ```
 */
@Component({
	selector: 'mcms-sidebar-content',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarContent {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'flex-1 overflow-y-auto px-2 py-2';
		return `${base} ${this.class()}`.trim();
	});
}

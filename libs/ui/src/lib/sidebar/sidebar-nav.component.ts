import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Container for sidebar navigation items.
 *
 * @example
 * ```html
 * <mcms-sidebar-nav>
 *   <mcms-sidebar-nav-item label="Dashboard" href="/dashboard" />
 *   <mcms-sidebar-section title="Settings">
 *     <mcms-sidebar-nav-item label="Profile" href="/settings/profile" />
 *   </mcms-sidebar-section>
 * </mcms-sidebar-nav>
 * ```
 */
@Component({
	selector: 'mcms-sidebar-nav',
	host: {
		role: 'navigation',
		'[attr.aria-label]': 'ariaLabel()',
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNav {
	/** Accessible label for the navigation. */
	readonly ariaLabel = input('Sidebar navigation');

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'flex flex-col gap-1';
		return `${base} ${this.class()}`.trim();
	});
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Header section of the sidebar, typically for branding/logo.
 *
 * @example
 * ```html
 * <mcms-sidebar-header>
 *   <h1>My App</h1>
 * </mcms-sidebar-header>
 * ```
 */
@Component({
	selector: 'mcms-sidebar-header',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarHeader {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'flex items-center px-4 py-4 border-b border-sidebar-border shrink-0';
		return `${base} ${this.class()}`.trim();
	});
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Footer section of the sidebar, typically for user info or actions.
 *
 * @example
 * ```html
 * <mcms-sidebar-footer>
 *   <div class="flex items-center gap-2">
 *     <mcms-avatar>...</mcms-avatar>
 *     <span>John Doe</span>
 *   </div>
 * </mcms-sidebar-footer>
 * ```
 */
@Component({
	selector: 'mcms-sidebar-footer',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarFooter {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'px-2 py-2 border-t border-sidebar-border shrink-0';
		return `${base} ${this.class()}`.trim();
	});
}

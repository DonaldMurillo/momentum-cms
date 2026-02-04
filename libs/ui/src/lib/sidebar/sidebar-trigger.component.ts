import { ChangeDetectionStrategy, Component, inject, input, computed } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroBars3, heroXMark } from '@ng-icons/heroicons/outline';
import { SidebarService } from './sidebar.service';

/**
 * A trigger button that toggles the sidebar open/closed state.
 *
 * Shows a hamburger menu icon when sidebar is closed, and an X icon when open (mobile only).
 * Automatically connects to the SidebarService for state management.
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <mcms-sidebar-trigger />
 *
 * <!-- With custom classes -->
 * <mcms-sidebar-trigger class="text-foreground" />
 * ```
 */
@Component({
	selector: 'mcms-sidebar-trigger',
	imports: [NgIcon],
	providers: [provideIcons({ heroBars3, heroXMark })],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<button
			type="button"
			(click)="sidebar.toggle()"
			[attr.aria-expanded]="sidebar.open()"
			[attr.aria-label]="ariaLabel()"
			class="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
		>
			<ng-icon [name]="iconName()" size="24" aria-hidden="true" />
		</button>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarTrigger {
	readonly sidebar = inject(SidebarService);

	/** Additional CSS classes. */
	readonly class = input('');

	/** Accessible label for the button. */
	readonly ariaLabel = computed(() => (this.sidebar.open() ? 'Close sidebar' : 'Open sidebar'));

	/** Icon to display based on sidebar state. */
	readonly iconName = computed(() =>
		this.sidebar.isMobile() && this.sidebar.open() ? 'heroXMark' : 'heroBars3',
	);

	readonly hostClasses = computed(() => `${this.class()}`.trim());
}

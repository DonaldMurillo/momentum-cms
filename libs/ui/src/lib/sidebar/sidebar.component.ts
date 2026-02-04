import { ChangeDetectionStrategy, Component, computed, inject, input, effect } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { SidebarService } from './sidebar.service';

/**
 * A responsive sidebar container component with slots for header, content, and footer.
 *
 * Features:
 * - Mobile: Renders as a drawer overlay that slides in from left
 * - Desktop: Renders as a static sidebar with optional collapsed state
 * - Uses CDK FocusTrap for accessibility on mobile drawer
 * - Integrates with SidebarService for app-wide state management
 *
 * @example
 * ```html
 * <mcms-sidebar>
 *   <div mcmsSidebarHeader>
 *     <h1>Logo</h1>
 *   </div>
 *   <div mcmsSidebarContent>
 *     <mcms-sidebar-nav>
 *       <mcms-sidebar-nav-item label="Dashboard" href="/dashboard" />
 *     </mcms-sidebar-nav>
 *   </div>
 *   <div mcmsSidebarFooter>
 *     <p>Footer content</p>
 *   </div>
 * </mcms-sidebar>
 * ```
 */
@Component({
	selector: 'mcms-sidebar',
	imports: [NgTemplateOutlet, A11yModule],
	host: {
		class: 'block',
	},
	template: `
		@if (sidebar.isMobile()) {
			<!-- Mobile: Drawer overlay -->
			@if (sidebar.open()) {
				<div
					class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
					(click)="sidebar.setOpen(false)"
					aria-hidden="true"
				></div>
			}
			<aside
				[class]="mobileClasses()"
				cdkTrapFocus
				[cdkTrapFocusAutoCapture]="sidebar.open()"
				role="dialog"
				[attr.aria-modal]="sidebar.open() || null"
				aria-label="Sidebar navigation"
			>
				<ng-container *ngTemplateOutlet="sidebarContent" />
			</aside>
		} @else {
			<!-- Desktop: Static sidebar -->
			<aside [class]="desktopClasses()" [style.width]="desktopWidth()" role="navigation">
				<ng-container *ngTemplateOutlet="sidebarContent" />
			</aside>
		}

		<ng-template #sidebarContent>
			<!-- Header: stays at top -->
			<div class="shrink-0 px-3 py-4">
				<ng-content select="[mcmsSidebarHeader]" />
			</div>
			<!-- Content: scrollable nav area -->
			<div class="flex-1 overflow-y-auto px-2">
				<ng-content select="[mcmsSidebarContent]" />
			</div>
			<!-- Footer: always at bottom -->
			<div class="shrink-0 border-t border-sidebar-border px-2 py-2">
				<ng-content select="[mcmsSidebarFooter]" />
			</div>
			<ng-content />
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
	readonly sidebar = inject(SidebarService);

	/** Width of the sidebar when expanded. */
	readonly width = input('16rem');

	/** Width of the sidebar when collapsed. */
	readonly collapsedWidth = input('4rem');

	/**
	 * Whether the sidebar is collapsed.
	 * This input syncs with SidebarService for backward compatibility.
	 */
	readonly collapsed = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	constructor() {
		// Sync collapsed input with service for backward compatibility
		effect(() => {
			const inputCollapsed = this.collapsed();
			if (inputCollapsed !== this.sidebar.collapsed()) {
				this.sidebar.setCollapsed(inputCollapsed);
			}
		});
	}

	/** Classes for mobile drawer */
	readonly mobileClasses = computed(() => {
		const base =
			'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out';
		const transform = this.sidebar.open() ? 'translate-x-0' : '-translate-x-full';
		return `${base} ${transform} ${this.class()}`.trim();
	});

	/** Classes for desktop sidebar */
	readonly desktopClasses = computed(() => {
		const base =
			'flex flex-col h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200';
		return `${base} ${this.class()}`.trim();
	});

	/** Width for desktop sidebar */
	readonly desktopWidth = computed(() =>
		this.sidebar.collapsed() ? this.collapsedWidth() : this.width(),
	);
}

import {
	Injectable,
	inject,
	signal,
	computed,
	PLATFORM_ID,
	DestroyRef,
	type Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Sidebar state representing current mode */
export type SidebarState = 'mobile-open' | 'mobile-closed' | 'collapsed' | 'expanded';

/**
 * Service for managing sidebar state across the application.
 *
 * Uses CDK BreakpointObserver for responsive detection and provides
 * keyboard shortcuts (Cmd+B / Ctrl+B to toggle, Escape to close on mobile).
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private readonly sidebar = inject(SidebarService);
 *
 *   toggleSidebar(): void {
 *     this.sidebar.toggle();
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SidebarService {
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly destroyRef = inject(DestroyRef);

	/** Whether the sidebar is open (mobile) - starts closed on mobile */
	readonly open = signal(false);

	/** Whether the sidebar is collapsed (desktop) */
	readonly collapsed = signal(false);

	/** Whether we're on a mobile viewport (<768px) */
	readonly isMobile: Signal<boolean> = isPlatformBrowser(this.platformId)
		? toSignal(
				this.breakpointObserver
					.observe(['(max-width: 767px)'])
					.pipe(map((result) => result.matches)),
				{ initialValue: false },
			)
		: signal(false);

	/** Current sidebar state */
	readonly state = computed((): SidebarState => {
		if (this.isMobile()) {
			return this.open() ? 'mobile-open' : 'mobile-closed';
		}
		return this.collapsed() ? 'collapsed' : 'expanded';
	});

	/** Toggle sidebar - opens/closes on mobile, collapses/expands on desktop */
	toggle(): void {
		if (this.isMobile()) {
			this.open.update((v) => !v);
		} else {
			this.collapsed.update((v) => !v);
		}
	}

	/** Set sidebar open state (for mobile drawer) */
	setOpen(open: boolean): void {
		this.open.set(open);
	}

	/** Set sidebar collapsed state (for desktop) */
	setCollapsed(collapsed: boolean): void {
		this.collapsed.set(collapsed);
	}

	/**
	 * Setup keyboard shortcuts for sidebar control.
	 * - Cmd+B (Mac) / Ctrl+B (Windows): Toggle sidebar
	 * - Escape: Close mobile drawer
	 *
	 * Call this from your root component's ngOnInit.
	 */
	setupKeyboardShortcuts(): void {
		if (!isPlatformBrowser(this.platformId)) return;

		const handler = (event: KeyboardEvent): void => {
			// Cmd+B (Mac) or Ctrl+B (Windows/Linux)
			if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
				event.preventDefault();
				this.toggle();
			}
			// Escape closes mobile drawer
			if (event.key === 'Escape' && this.isMobile() && this.open()) {
				this.setOpen(false);
			}
		};

		document.addEventListener('keydown', handler);

		// Cleanup on destroy
		this.destroyRef.onDestroy(() => {
			document.removeEventListener('keydown', handler);
		});
	}
}

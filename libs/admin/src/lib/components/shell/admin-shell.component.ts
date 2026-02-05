import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	OnInit,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, ActivatedRoute, Router } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { SidebarService, SidebarTrigger } from '@momentum-cms/ui';
import { getCollectionsFromRouteData, getBrandingFromRouteData } from '../../utils/route-data';
import { MomentumAuthService } from '../../services/auth.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { injectUser } from '../../utils/inject-user';
import { AdminSidebarWidget } from '../../widgets/admin-sidebar/admin-sidebar.component';
import type { AdminUser, AdminBranding } from '../../widgets/widget.types';

/**
 * Admin Shell Component
 *
 * The main layout component for the admin UI.
 * Provides navigation sidebar and content area.
 *
 * Features:
 * - Responsive sidebar (drawer on mobile, static on desktop)
 * - Keyboard shortcuts (Cmd+B / Ctrl+B to toggle sidebar)
 * - Mobile header with hamburger menu
 */
@Component({
	selector: 'mcms-admin-shell',
	imports: [RouterOutlet, AdminSidebarWidget, SidebarTrigger],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'flex h-screen overflow-hidden bg-background' },
	template: `
		<!-- Mobile header with hamburger (hidden at md breakpoint = 768px+) -->
		<header
			class="md:hidden fixed top-0 inset-x-0 h-14 border-b border-border bg-background z-30 flex items-center px-4 gap-4"
		>
			<mcms-sidebar-trigger />
			<span class="font-semibold">{{ sidebarBranding()?.title || 'Momentum CMS' }}</span>
		</header>

		<mcms-admin-sidebar
			[branding]="sidebarBranding()"
			[collections]="collections()"
			[user]="sidebarUser()"
			basePath="/admin"
			(signOut)="onSignOut()"
		/>

		<!-- Main Content (with top padding on mobile for header, normal padding at md+) -->
		<main class="flex-1 p-8 overflow-y-auto overflow-x-hidden pt-20 md:pt-8">
			@defer (hydrate on immediate) {
				<router-outlet></router-outlet>
			}
		</main>
	`,
})
export class AdminShellComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly auth = inject(MomentumAuthService);
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly sidebar = inject(SidebarService);

	/** All collections from route data */
	private readonly allCollections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.snapshot.data);
	});

	/** Collections filtered by access permissions */
	readonly collections = computed((): CollectionConfig[] => {
		const all = this.allCollections();
		const accessible = this.collectionAccess.accessibleCollections();

		// If permissions not loaded yet, show all (will be filtered after load)
		if (!this.collectionAccess.initialized()) {
			return all;
		}

		// Filter to only accessible collections
		return all.filter((c) => accessible.includes(c.slug));
	});

	/** Branding for sidebar */
	readonly sidebarBranding = computed((): AdminBranding | undefined => {
		const routeBranding = getBrandingFromRouteData(this.route.snapshot.data);
		if (!routeBranding) return undefined;
		return {
			title: routeBranding.title,
			logo: routeBranding.logo,
		};
	});

	/** SSR-aware user signal (reads from MOMENTUM_API_CONTEXT during SSR, auth service in browser) */
	private readonly currentUser = injectUser();

	/** User for sidebar */
	readonly sidebarUser = computed((): AdminUser | null => {
		const user = this.currentUser();
		if (!user) return null;
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		};
	});

	ngOnInit(): void {
		// Keyboard shortcuts and auth service initialization only run in the browser.
		// SSR user is provided via MOMENTUM_API_CONTEXT (used by injectUser above).
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		this.sidebar.setupKeyboardShortcuts();
		this.initializeAuth();
	}

	private async initializeAuth(): Promise<void> {
		// Wait for auth to initialize if still loading
		if (this.auth.loading()) {
			await this.auth.initialize();
		}

		// Redirect to setup if no users exist
		if (this.auth.needsSetup()) {
			await this.router.navigate(['/admin/setup']);
			return;
		}

		// Redirect to login if not authenticated
		if (!this.auth.isAuthenticated()) {
			await this.router.navigate(['/admin/login']);
			return;
		}

		// Load collection access permissions
		if (!this.collectionAccess.initialized()) {
			this.collectionAccess.loadAccess();
		}
	}

	async onSignOut(): Promise<void> {
		await this.auth.signOut();
		await this.router.navigate(['/admin/login']);
	}
}

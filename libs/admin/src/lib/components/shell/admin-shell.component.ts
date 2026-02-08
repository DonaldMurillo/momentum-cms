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
import { A11yModule } from '@angular/cdk/a11y';
import type { CollectionConfig } from '@momentum-cms/core';
import { SidebarService, SidebarTrigger } from '@momentum-cms/ui';
import {
	getCollectionsFromRouteData,
	getBrandingFromRouteData,
	getPluginRoutesFromRouteData,
} from '../../utils/route-data';
import type { AdminPluginRoute } from '../../routes/momentum-admin-routes';
import { MomentumAuthService } from '../../services/auth.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { EntitySheetService } from '../../services/entity-sheet.service';
import { EntitySheetContentComponent } from '../entity-sheet/entity-sheet-content.component';
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
 * - Entity sheet for inline entity create/edit/view (driven by query params)
 */
@Component({
	selector: 'mcms-admin-shell',
	imports: [
		RouterOutlet,
		AdminSidebarWidget,
		SidebarTrigger,
		A11yModule,
		EntitySheetContentComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex h-screen overflow-hidden bg-background',
		'(document:keydown.escape)': 'onEscapeKey()',
	},
	styles: `
		@keyframes mcms-fade-in {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
		@keyframes mcms-slide-in-right {
			from {
				transform: translateX(100%);
			}
			to {
				transform: translateX(0);
			}
		}
		.sheet-backdrop {
			animation: mcms-fade-in 0.15s ease-out;
		}
		.sheet-panel {
			animation: mcms-slide-in-right 0.2s ease-out;
		}
	`,
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
			[pluginRoutes]="pluginRoutes()"
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

		<!-- Entity Sheet (query-param driven, no named router outlet) -->
		@if (entitySheet.isOpen()) {
			<div class="fixed inset-0 z-50" role="presentation">
				<!-- Backdrop -->
				<div
					class="sheet-backdrop absolute inset-0 bg-black/50"
					role="button"
					tabindex="0"
					aria-label="Close sheet"
					(click)="onSheetBackdropClick()"
					(keydown.enter)="onSheetBackdropClick()"
					(keydown.space)="onSheetBackdropClick()"
				></div>
				<!-- Sheet panel -->
				<div
					class="sheet-panel absolute inset-y-0 right-0 w-full max-w-2xl bg-card border-l border-border shadow-xl flex flex-col"
					role="dialog"
					aria-modal="true"
					cdkTrapFocus
					cdkTrapFocusAutoCapture
				>
					<mcms-entity-sheet-content />
				</div>
			</div>
		}
	`,
})
export class AdminShellComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly auth = inject(MomentumAuthService);
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly sidebar = inject(SidebarService);
	readonly entitySheet = inject(EntitySheetService);

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

	/** Plugin routes from route data */
	readonly pluginRoutes = computed((): AdminPluginRoute[] => {
		return getPluginRoutesFromRouteData(this.route.snapshot.data);
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
		// Keyboard shortcuts, auth, and sheet restoration only run in the browser.
		// SSR user is provided via MOMENTUM_API_CONTEXT (used by injectUser above).
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		this.sidebar.setupKeyboardShortcuts();
		this.entitySheet.initFromQueryParams();
		this.initializeAuth();
	}

	/** Close the sheet when the Escape key is pressed */
	onEscapeKey(): void {
		if (this.entitySheet.isOpen()) {
			this.entitySheet.close();
		}
	}

	/** Close the sheet when the backdrop is clicked */
	onSheetBackdropClick(): void {
		this.entitySheet.close();
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

import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	OnInit,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, ActivatedRoute, Router } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { Button } from '@momentum-cms/ui';
import type { MomentumAdminBranding } from '../../routes/momentum-admin-routes';
import { getCollectionsFromRouteData, getBrandingFromRouteData } from '../../utils/route-data';
import { MomentumAuthService } from '../../services/auth.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { McmsThemeService } from '../../ui/theme/theme.service';

/**
 * Admin Shell Component
 *
 * The main layout component for the admin UI.
 * Provides navigation sidebar and content area.
 */
@Component({
	selector: 'mcms-admin-shell',
	imports: [RouterOutlet, RouterLink, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'flex min-h-screen bg-background' },
	template: `
		<!-- Sidebar -->
		<aside class="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
			<div class="p-6 border-b border-sidebar-border">
				@if (branding()?.logo) {
					<img [src]="branding()!.logo" alt="Logo" class="h-8 mb-2" />
				}
				<h1 class="text-xl font-semibold">{{ branding()?.title || 'Momentum CMS' }}</h1>
			</div>

			<nav class="flex-1 p-4">
				<a
					routerLink="."
					class="block px-4 py-3 mb-4 text-sidebar-foreground/80 no-underline rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
				>
					Dashboard
				</a>

				<div class="mt-4">
					<h2 class="text-xs font-semibold text-sidebar-foreground/60 uppercase px-4 py-2">
						Collections
					</h2>
					@for (collection of collections(); track collection.slug) {
						<a
							[routerLink]="['collections', collection.slug]"
							class="block px-4 py-3 text-sidebar-foreground/80 no-underline rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
						>
							{{ collection.labels?.plural || collection.slug }}
						</a>
					}
				</div>
			</nav>

			<!-- User section -->
			@if (auth.user(); as user) {
				<div class="p-4 border-t border-sidebar-border">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium"
						>
							{{ userInitials() }}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{{ user.name }}</p>
							<p class="text-xs text-sidebar-foreground/60 truncate">{{ user.email }}</p>
						</div>
					</div>
					<button
						mcms-button
						variant="ghost"
						size="sm"
						class="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground mb-1"
						(click)="toggleTheme()"
					>
						{{ theme.isDark() ? 'Light mode' : 'Dark mode' }}
					</button>
					<button
						mcms-button
						variant="ghost"
						size="sm"
						class="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
						(click)="onSignOut()"
					>
						Sign out
					</button>
				</div>
			}
		</aside>

		<!-- Main Content -->
		<main class="flex-1 p-8 overflow-auto">
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
	readonly auth = inject(MomentumAuthService);
	readonly collectionAccess = inject(CollectionAccessService);
	readonly theme = inject(McmsThemeService);

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

	ngOnInit(): void {
		// Only run on client side - SSR doesn't have access to auth cookies
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}

		// Initialize auth and check session on client-side hydration
		// This is needed because guards don't re-run on hydration
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

	readonly branding = computed((): MomentumAdminBranding | undefined => {
		return getBrandingFromRouteData(this.route.snapshot.data);
	});

	readonly userInitials = computed((): string => {
		const user = this.auth.user();
		if (!user?.name) return '?';
		return user.name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	});

	toggleTheme(): void {
		this.theme.toggleTheme();
	}

	async onSignOut(): Promise<void> {
		await this.auth.signOut();
		await this.router.navigate(['/admin/login']);
	}
}

import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, ActivatedRoute, Router } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { Button } from '@momentum-cms/ui';
import type { MomentumAdminBranding } from '../../routes/momentum-admin-routes';
import { getCollectionsFromRouteData, getBrandingFromRouteData } from '../../utils/route-data';
import { MomentumAuthService } from '../../services/auth.service';
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
export class AdminShellComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	readonly auth = inject(MomentumAuthService);
	readonly theme = inject(McmsThemeService);

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.snapshot.data);
	});

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

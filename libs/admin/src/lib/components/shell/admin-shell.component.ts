import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import type { MomentumAdminBranding } from '../../routes/momentum-admin-routes';
import { getCollectionsFromRouteData, getBrandingFromRouteData } from '../../utils/route-data';

/**
 * Admin Shell Component
 *
 * The main layout component for the admin UI.
 * Provides navigation sidebar and content area.
 */
@Component({
	selector: 'mcms-admin-shell',
	imports: [RouterOutlet, RouterLink],
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

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.snapshot.data);
	});

	readonly branding = computed((): MomentumAdminBranding | undefined => {
		return getBrandingFromRouteData(this.route.snapshot.data);
	});
}

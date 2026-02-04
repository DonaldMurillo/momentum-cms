import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { CollectionCardWidget } from '../../widgets/collection-card/collection-card.component';

/**
 * Dashboard Page Component
 *
 * The main dashboard showing an overview of all collections.
 */
@Component({
	selector: 'mcms-dashboard',
	imports: [CollectionCardWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<h1 class="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
			<p class="text-muted-foreground mt-3 text-lg">Manage your content and collections</p>
		</header>

		<section>
			<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
				Collections
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
				@for (collection of collections(); track collection.slug) {
					<mcms-collection-card [collection]="collection" [basePath]="basePath" />
				} @empty {
					<div
						class="col-span-full flex flex-col items-center justify-center p-16 bg-card/50 rounded-xl border border-dashed border-border/60"
					>
						<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
							<svg
								class="w-8 h-8 text-muted-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
						</div>
						<p class="text-foreground font-medium text-lg">No collections configured</p>
						<p class="text-sm text-muted-foreground mt-2 text-center max-w-sm">
							Add collections to your configuration to start managing content.
						</p>
					</div>
				}
			</div>
		</section>
	`,
})
export class DashboardPage {
	private readonly route = inject(ActivatedRoute);

	readonly basePath = '/admin/collections';

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.parent?.snapshot.data);
	});
}

import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';

/**
 * Dashboard Page Component
 *
 * The main dashboard showing an overview of all collections.
 */
@Component({
	selector: 'mcms-dashboard',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-5xl' },
	template: `
		<header class="mb-8">
			<h1 class="text-3xl font-bold text-foreground">Dashboard</h1>
			<p class="text-muted-foreground mt-2">Welcome to Momentum CMS</p>
		</header>

		<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
			@for (collection of collections(); track collection.slug) {
				<a
					[routerLink]="['collections', collection.slug]"
					class="bg-card text-card-foreground rounded-lg p-6 no-underline border border-border transition-all hover:border-primary hover:shadow-md"
				>
					<h2 class="text-xl font-semibold text-foreground mb-1">
						{{ collection.labels?.plural || collection.slug }}
					</h2>
					<p class="text-sm text-muted-foreground font-mono mb-4">{{ collection.slug }}</p>
					<div class="text-sm text-muted-foreground">
						<span>{{ collection.fields.length }} fields</span>
					</div>
				</a>
			} @empty {
				<div
					class="col-span-full text-center p-12 bg-card rounded-lg border-2 border-dashed border-border"
				>
					<p class="text-foreground">No collections configured.</p>
					<p class="text-sm text-muted-foreground mt-2">
						Add collections to your configuration to get started.
					</p>
				</div>
			}
		</div>
	`,
})
export class DashboardPage {
	private readonly route = inject(ActivatedRoute);

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.parent?.snapshot.data);
	});
}

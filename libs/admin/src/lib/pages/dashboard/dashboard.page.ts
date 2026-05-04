import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentumcms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { CollectionAccessService } from '../../services/collection-access.service';
import { CollectionCardWidget } from '../../widgets/collection-card/collection-card.component';
import { groupCollections } from '../../utils/group-collections';
import { AdminSlotOutlet } from '../../components/admin-slot-outlet/admin-slot-outlet.component';

/**
 * Dashboard Page Component — overview of workspace collections, grouped by
 * `admin.group`, rendered as editorial list-rows rather than a templated tile
 * grid (impeccable: avoid identical card grids).
 */
@Component({
	selector: 'mcms-dashboard',
	imports: [CollectionCardWidget, AdminSlotOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-5xl' },
	template: `
		<mcms-admin-slot slot="dashboard:before" />

		<header class="mb-12 flex flex-col gap-2">
			<span class="mcms-eyebrow">Workspace</span>
			<h1 class="text-2xl font-semibold -tracking-[0.02em]">Dashboard</h1>
			<p class="mcms-page-subtitle">
				A snapshot of every collection in this workspace and how much content lives in each.
			</p>
		</header>

		@if (collectionGroups().length === 0) {
			<section aria-label="Collections" class="border-t border-border pt-10">
				<p class="text-base font-medium text-foreground">No collections yet</p>
				<p class="mcms-page-subtitle mt-1.5">
					Add a collection to your <code class="mcms-mono">momentum.config.ts</code> and restart the
					dev server. The dashboard will pick it up automatically.
				</p>
			</section>
		} @else {
			<div class="flex flex-col gap-12">
				@for (group of collectionGroups(); track group.id) {
					<section [attr.aria-labelledby]="group.id" class="flex flex-col gap-3">
						<div class="flex items-baseline justify-between">
							<h2 [id]="group.id" class="mcms-eyebrow">
								{{ group.name }}
							</h2>
							<span class="mcms-mono text-2xs">
								{{ group.collections.length }}
								{{ group.collections.length === 1 ? 'collection' : 'collections' }}
							</span>
						</div>
						<ul class="flex flex-col border-t border-border">
							@for (collection of group.collections; track collection.slug) {
								<li>
									<mcms-collection-card [collection]="collection" [basePath]="basePath" />
								</li>
							}
						</ul>
					</section>
				}
			</div>
		}

		<mcms-admin-slot slot="dashboard:after" />
	`,
})
export class DashboardPage {
	private readonly route = inject(ActivatedRoute);
	private readonly collectionAccess = inject(CollectionAccessService);

	readonly basePath = '/admin/collections';

	private readonly allCollections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.parent?.snapshot.data);
	});

	readonly collections = computed((): CollectionConfig[] => {
		const all = this.allCollections();
		const accessible = this.collectionAccess.accessibleCollections();
		if (!this.collectionAccess.initialized()) {
			return all.filter((c) => !c.admin?.hidden);
		}
		return all.filter((c) => !c.admin?.hidden && accessible.includes(c.slug));
	});

	readonly collectionGroups = computed(() => groupCollections(this.collections()));
}

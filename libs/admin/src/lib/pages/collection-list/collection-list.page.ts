import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityListWidget } from '../../widgets/entity-list/entity-list.component';
import type { Entity } from '../../widgets/widget.types';

/**
 * Collection List Page Component
 *
 * Displays a list of documents in a collection using the EntityListWidget.
 */
@Component({
	selector: 'mcms-collection-list',
	imports: [EntityListWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			<mcms-entity-list
				[collection]="col"
				[basePath]="basePath"
				(entityClick)="onEntityClick($event)"
			/>
		} @else {
			<div class="p-12 text-center text-muted-foreground">Collection not found</div>
		}
	`,
})
export class CollectionListPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly basePath = '/admin/collections';

	// Reactive slug signal that updates when route params change
	private readonly slug = toSignal(
		this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
		{ initialValue: this.route.snapshot.paramMap.get('slug') ?? '' },
	);

	readonly collection = computed((): CollectionConfig | undefined => {
		const currentSlug = this.slug();
		if (!currentSlug) return undefined;

		const collections = getCollectionsFromRouteData(this.route.parent?.snapshot.data);
		return collections.find((c) => c.slug === currentSlug);
	});

	onEntityClick(entity: Entity): void {
		const col = this.collection();
		if (col) {
			this.router.navigate([this.basePath, col.slug, entity.id]);
		}
	}
}

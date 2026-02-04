import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityViewWidget } from '../../widgets/entity-view/entity-view.component';
import type { Entity } from '../../widgets/widget.types';

/**
 * Collection View Page Component
 *
 * Displays a read-only view of a document using the EntityViewWidget.
 */
@Component({
	selector: 'mcms-collection-view',
	imports: [EntityViewWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			@if (entityId(); as id) {
				<mcms-entity-view
					[collection]="col"
					[entityId]="id"
					[basePath]="basePath"
					(edit)="onEdit($event)"
					(delete_)="onDelete($event)"
				/>
			} @else {
				<div class="p-12 text-center text-muted-foreground">Entity ID not provided</div>
			}
		} @else {
			<div class="p-12 text-center text-muted-foreground">Collection not found</div>
		}
	`,
})
export class CollectionViewPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly basePath = '/admin/collections';

	// Reactive slug signal that updates when route params change
	private readonly slug = toSignal(
		this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
		{ initialValue: this.route.snapshot.paramMap.get('slug') ?? '' },
	);

	// Reactive entity ID signal
	readonly entityId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
		initialValue: this.route.snapshot.paramMap.get('id') ?? '',
	});

	readonly collection = computed((): CollectionConfig | undefined => {
		const currentSlug = this.slug();
		if (!currentSlug) return undefined;

		const collections = getCollectionsFromRouteData(this.route.parent?.snapshot.data);
		return collections.find((c) => c.slug === currentSlug);
	});

	onEdit(entity: Entity): void {
		const col = this.collection();
		if (col) {
			this.router.navigate([this.basePath, col.slug, entity.id, 'edit']);
		}
	}

	onDelete(_entity: Entity): void {
		// Navigation is handled by EntityViewWidget
	}
}

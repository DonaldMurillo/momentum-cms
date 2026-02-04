import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityFormWidget } from '../../widgets/entity-form/entity-form.component';
import type { EntityFormMode } from '../../widgets/entity-form/entity-form.types';

/**
 * Collection Edit Page Component
 *
 * Form for creating or editing a document in a collection using EntityFormWidget.
 */
@Component({
	selector: 'mcms-collection-edit',
	imports: [EntityFormWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			<mcms-entity-form
				[collection]="col"
				[entityId]="entityId()"
				[mode]="mode()"
				[basePath]="basePath"
			/>
		} @else {
			<div class="p-12 text-center text-muted-foreground">Collection not found</div>
		}
	`,
})
export class CollectionEditPage {
	private readonly route = inject(ActivatedRoute);

	readonly basePath = '/admin/collections';

	readonly entityId = computed((): string | undefined => {
		const id = this.route.snapshot.paramMap.get('id');
		// 'create' or null means create mode (no entity ID)
		if (id === 'create' || id === null) {
			return undefined;
		}
		return id;
	});

	readonly mode = computed((): EntityFormMode => {
		return this.entityId() ? 'edit' : 'create';
	});

	readonly collection = computed((): CollectionConfig | undefined => {
		const slug = this.route.snapshot.paramMap.get('slug');
		const collections = getCollectionsFromRouteData(this.route.parent?.snapshot.data);
		return collections.find((c) => c.slug === slug);
	});
}

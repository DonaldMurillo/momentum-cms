import { Component, ChangeDetectionStrategy, inject, computed, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityFormWidget } from '../../widgets/entity-form/entity-form.component';
import type { EntityFormMode } from '../../widgets/entity-form/entity-form.types';
import { LivePreviewComponent } from '../../widgets/live-preview/live-preview.component';

/**
 * Collection Edit Page Component
 *
 * Form for creating or editing a document in a collection using EntityFormWidget.
 * When preview is enabled on the collection, shows a live preview panel alongside the form.
 */
@Component({
	selector: 'mcms-collection-edit',
	imports: [EntityFormWidget, LivePreviewComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			@if (previewConfig(); as preview) {
				<!-- Split layout: form + preview -->
				<div class="flex gap-0 h-[calc(100vh-64px)]" data-testid="preview-layout">
					<div class="flex-1 overflow-y-auto p-6">
						<mcms-entity-form
							#entityForm
							[collection]="col"
							[entityId]="entityId()"
							[mode]="mode()"
							[basePath]="basePath"
						/>
					</div>
					<div class="w-[50%] min-w-[400px] max-w-[720px]">
						<mcms-live-preview
							[preview]="preview"
							[documentData]="formData()"
							[collectionSlug]="col.slug"
							[entityId]="entityId()"
						/>
					</div>
				</div>
			} @else {
				<!-- Standard layout: form only -->
				<mcms-entity-form
					#entityForm
					[collection]="col"
					[entityId]="entityId()"
					[mode]="mode()"
					[basePath]="basePath"
				/>
			}
		} @else {
			<div class="p-12 text-center text-muted-foreground">Collection not found</div>
		}
	`,
})
export class CollectionEditPage {
	private readonly route = inject(ActivatedRoute);

	readonly basePath = '/admin/collections';

	/** Reference to the entity form widget to read its formData signal */
	private readonly entityFormRef = viewChild<EntityFormWidget>('entityForm');

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

	/** Preview config from collection admin settings (false-y when not configured) */
	readonly previewConfig = computed(
		(): boolean | ((doc: Record<string, unknown>) => string) | undefined => {
			const col = this.collection();
			return col?.admin?.preview || undefined;
		},
	);

	/** Reactive form data from the entity form widget */
	readonly formData = computed((): Record<string, unknown> => {
		const form = this.entityFormRef();
		return form?.formData() ?? {};
	});
}

import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { CollectionConfig } from '@momentum-cms/core';
import { Button } from '@momentum-cms/ui';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityViewWidget } from '../../widgets/entity-view/entity-view.component';
import { LivePreviewComponent } from '../../widgets/live-preview/live-preview.component';
import type { Entity } from '../../widgets/widget.types';

/**
 * Collection View Page Component
 *
 * Displays a read-only view of a document using the EntityViewWidget.
 * When preview is enabled, shows a toggleable live preview panel.
 */
@Component({
	selector: 'mcms-collection-view',
	imports: [EntityViewWidget, LivePreviewComponent, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			@if (entityId(); as id) {
				@if (previewConfig(); as preview) {
					@if (showPreview()) {
						<!-- Split layout: entity view + preview -->
						<div class="flex gap-0 h-[calc(100vh-64px)]" data-testid="preview-layout">
							<div class="flex-1 overflow-y-auto p-6">
								<mcms-entity-view
									#entityView
									[collection]="col"
									[entityId]="id"
									[basePath]="basePath"
									(edit)="onEdit($event)"
									(delete_)="onDelete($event)"
								>
									<div entityViewHeaderExtra class="mt-3">
										<button
											mcms-button
											variant="ghost"
											size="sm"
											data-testid="preview-toggle"
											(click)="showPreview.set(false)"
										>
											Hide Preview
										</button>
									</div>
								</mcms-entity-view>
							</div>
							<div class="w-[50%] min-w-[400px] max-w-[720px]">
								<mcms-live-preview
									[preview]="preview"
									[documentData]="viewEntityData()"
									[collectionSlug]="col.slug"
									[entityId]="id"
								/>
							</div>
						</div>
					} @else {
						<!-- Full-width view (preview hidden) -->
						<mcms-entity-view
							#entityView
							[collection]="col"
							[entityId]="id"
							[basePath]="basePath"
							(edit)="onEdit($event)"
							(delete_)="onDelete($event)"
						>
							<div entityViewHeaderExtra class="mt-3">
								<button
									mcms-button
									variant="ghost"
									size="sm"
									data-testid="preview-toggle"
									(click)="showPreview.set(true)"
								>
									Show Preview
								</button>
							</div>
						</mcms-entity-view>
					}
				} @else {
					<!-- No preview configured -->
					<mcms-entity-view
						#entityView
						[collection]="col"
						[entityId]="id"
						[basePath]="basePath"
						(edit)="onEdit($event)"
						(delete_)="onDelete($event)"
					/>
				}
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

	/** Whether the live preview panel is visible */
	readonly showPreview = signal(true);

	/** Reference to the entity view widget to read its entity data */
	private readonly entityViewRef = viewChild<EntityViewWidget>('entityView');

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

	/** Preview config from collection admin settings */
	readonly previewConfig = computed(
		(): boolean | ((doc: Record<string, unknown>) => string) | undefined => {
			const col = this.collection();
			return col?.admin?.preview || undefined;
		},
	);

	/** Entity data from the entity view widget (for live preview) */
	readonly viewEntityData = computed((): Record<string, unknown> => {
		const view = this.entityViewRef();
		const entity = view?.entity();
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T extends Entity with index signature
		return (entity as Record<string, unknown>) ?? {};
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

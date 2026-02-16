import { Component, ChangeDetectionStrategy, inject, computed, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { AdminConfig, CollectionConfig } from '@momentumcms/core';
import { DialogService } from '@momentumcms/ui';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityListWidget } from '../../widgets/entity-list/entity-list.component';
import type { Entity, EntityAction } from '../../widgets/widget.types';
import type { EntityListBulkActionEvent } from '../../widgets/entity-list/entity-list.types';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { FeedbackService } from '../../widgets/feedback/feedback.service';
import {
	GenerateApiKeyDialog,
	type GenerateApiKeyDialogData,
} from '../../components/generate-api-key-dialog/generate-api-key-dialog.component';

/**
 * Collection List Page Component
 *
 * Displays a list of documents in a collection using the EntityListWidget.
 * Supports bulk actions (e.g., bulk delete) via selection checkboxes.
 */
@Component({
	selector: 'mcms-collection-list',
	imports: [EntityListWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			<mcms-entity-list
				#entityList
				[collection]="col"
				[basePath]="basePath"
				[selectable]="true"
				[bulkActions]="bulkActions()"
				[headerActions]="headerActions()"
				(entityClick)="onEntityClick($event)"
				(bulkAction)="onBulkAction($event)"
				(headerActionClick)="onHeaderAction($event)"
			/>
		} @else {
			<div class="p-12 text-center text-muted-foreground">Collection not found</div>
		}
	`,
})
export class CollectionListPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly api = injectMomentumAPI();
	private readonly feedback = inject(FeedbackService);
	private readonly dialog = inject(DialogService);

	readonly entityList = viewChild<EntityListWidget>('entityList');

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

	readonly headerActions = computed((): NonNullable<AdminConfig['headerActions']> => {
		return this.collection()?.admin?.headerActions ?? [];
	});

	readonly bulkActions = computed((): EntityAction[] => [
		{
			id: 'delete',
			label: 'Delete',
			variant: 'destructive',
			requiresConfirmation: true,
		},
	]);

	onEntityClick(entity: Entity): void {
		const col = this.collection();
		if (col) {
			this.router.navigate([this.basePath, col.slug, entity.id]);
		}
	}

	onHeaderAction(action: NonNullable<AdminConfig['headerActions']>[number]): void {
		if (action.id === 'generate-key' && action.endpoint) {
			const ref = this.dialog.open<GenerateApiKeyDialog, GenerateApiKeyDialogData, boolean>(
				GenerateApiKeyDialog,
				{
					width: '28rem',
					data: { endpoint: action.endpoint },
				},
			);
			ref.afterClosed.subscribe((created) => {
				if (created) {
					this.entityList()?.reload();
				}
			});
		}
	}

	async onBulkAction(event: EntityListBulkActionEvent): Promise<void> {
		const col = this.collection();
		if (!col) return;

		if (event.action.id === 'delete') {
			const ids = event.entities.map((e) => String(e.id));
			try {
				await this.api.collection(col.slug).batchDelete(ids);
				this.entityList()?.reload();
			} catch {
				// Error handled by crudToastInterceptor
			}
		}
	}
}

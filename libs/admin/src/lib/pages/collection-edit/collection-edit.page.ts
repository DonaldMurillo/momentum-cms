import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { Button, DialogService } from '@momentum-cms/ui';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { EntityFormWidget } from '../../widgets/entity-form/entity-form.component';
import type { EntityFormMode } from '../../widgets/entity-form/entity-form.types';
import { LivePreviewComponent } from '../../widgets/live-preview/live-preview.component';
import {
	BlockEditDialog,
	type BlockEditDialogData,
} from '../../widgets/visual-block-editor/block-edit-dialog.component';
import type { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';

/**
 * Collection Edit Page Component
 *
 * Form for creating or editing a document in a collection using EntityFormWidget.
 * When preview is enabled on the collection, shows a live preview panel alongside the form.
 */
@Component({
	selector: 'mcms-collection-edit',
	imports: [EntityFormWidget, LivePreviewComponent, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collection(); as col) {
			@if (previewConfig(); as preview) {
				@if (showPreview()) {
					<!-- Split layout: form + preview -->
					<div class="flex gap-0 h-[calc(100vh-64px)]" data-testid="preview-layout">
						<div class="flex-1 overflow-y-auto p-6">
							<mcms-entity-form
								#entityForm
								[collection]="col"
								[entityId]="entityId()"
								[mode]="mode()"
								[basePath]="basePath"
							>
								<div entityFormHeaderExtra class="mt-3">
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
							</mcms-entity-form>
						</div>
						<div class="w-[50%] min-w-[400px] max-w-[720px]">
							<mcms-live-preview
								[preview]="preview"
								[documentData]="formData()"
								[collectionSlug]="col.slug"
								[entityId]="entityId()"
								(editBlockRequest)="onEditBlockRequest($event)"
							/>
						</div>
					</div>
				} @else {
					<!-- Full-width form (preview hidden) -->
					<mcms-entity-form
						#entityForm
						[collection]="col"
						[entityId]="entityId()"
						[mode]="mode()"
						[basePath]="basePath"
					>
						<div entityFormHeaderExtra class="mt-3">
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
					</mcms-entity-form>
				}
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
export class CollectionEditPage implements HasUnsavedChanges {
	private readonly route = inject(ActivatedRoute);
	private readonly dialogService = inject(DialogService);

	readonly basePath = '/admin/collections';

	/** Whether the live preview panel is visible */
	readonly showPreview = signal(true);

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

	/** HasUnsavedChanges implementation for the route guard */
	hasUnsavedChanges(): boolean {
		return this.entityFormRef()?.isDirty() ?? false;
	}

	/** Handle edit block request from preview iframe overlay */
	onEditBlockRequest(blockIndex: number): void {
		const col = this.collection();
		const formRef = this.entityFormRef();
		if (!col || !formRef) return;

		// Find the blocks field in the collection
		const blocksField = col.fields.find((f) => f.type === 'blocks');
		if (!blocksField || blocksField.type !== 'blocks') return;

		// Get current block data to determine its type
		const data = formRef.formData();
		const blocksArray = data[blocksField.name];
		if (!Array.isArray(blocksArray) || !blocksArray[blockIndex]) return;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- blocksArray elements are untyped
		const block = blocksArray[blockIndex] as Record<string, unknown>;
		const blockType = block['blockType'];
		if (typeof blockType !== 'string') return;

		// Find the block config for this type
		const blockConfig = blocksField.blocks.find((b) => b.slug === blockType);
		if (!blockConfig) return;

		// Get the signal forms node for the blocks field
		const formNode = formRef.getFormNode(blocksField.name);

		this.dialogService.open<BlockEditDialog, BlockEditDialogData>(BlockEditDialog, {
			width: '32rem',
			data: {
				blockConfig,
				formNode,
				blockIndex,
				formTree: formRef.entityForm(),
				formModel: formRef.formModel(),
				mode: 'edit',
				path: blocksField.name,
			},
		});
	}
}

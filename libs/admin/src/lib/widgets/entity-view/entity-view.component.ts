import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { CollectionConfig, Field, DocumentStatus, ImageSizeConfig } from '@momentumcms/core';
import {
	humanizeFieldName,
	getSoftDeleteField,
	flattenDataFields,
	isUploadCollection,
} from '@momentumcms/core';
import {
	Button,
	Alert,
	Skeleton,
	FieldDisplay,
	Breadcrumbs,
	BreadcrumbItem,
	BreadcrumbSeparator,
} from '@momentumcms/ui';
import type {
	FieldDisplayType,
	FieldDisplayFieldMeta,
	FieldDisplayNumberFormat,
	FieldDisplayDateFormat,
} from '@momentumcms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';
import { isRecord, getTitleField } from '../entity-form/entity-form.types';
import type { Entity, EntityAction } from '../widget.types';
import type { EntityViewFieldConfig } from './entity-view.types';
import { VersionHistoryWidget } from '../version-history/version-history.component';
import { PublishControlsWidget } from '../publish-controls/publish-controls.component';
import {
	MediaPreviewComponent,
	type MediaPreviewData,
} from '../media-preview/media-preview.component';
import { FocalPointPickerComponent } from '../focal-point-picker/focal-point-picker.component';
import { ImageVariantsDisplay } from '../image-variants/image-variants-display.component';

/**
 * Entity View Widget
 *
 * Read-only entity display connected to Momentum API.
 *
 * @example
 * ```html
 * <mcms-entity-view
 *   [collection]="postsCollection"
 *   entityId="123"
 *   (edit)="onEdit($event)"
 *   (delete)="onDelete($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-entity-view',
	imports: [
		Button,
		Alert,
		Skeleton,
		FieldDisplay,
		Breadcrumbs,
		BreadcrumbItem,
		BreadcrumbSeparator,
		VersionHistoryWidget,
		PublishControlsWidget,
		MediaPreviewComponent,
		FocalPointPickerComponent,
		ImageVariantsDisplay,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="max-w-4xl">
			@if (showBreadcrumbs()) {
				<mcms-breadcrumbs class="mb-6">
					<mcms-breadcrumb-item [href]="dashboardPath()">Dashboard</mcms-breadcrumb-item>
					<mcms-breadcrumb-separator />
					<mcms-breadcrumb-item [href]="collectionListPath()">{{
						collectionLabel()
					}}</mcms-breadcrumb-item>
					<mcms-breadcrumb-separator />
					<mcms-breadcrumb-item [current]="true">{{ entityTitle() }}</mcms-breadcrumb-item>
				</mcms-breadcrumbs>
			}

			@if (isDeleted()) {
				<mcms-alert variant="destructive" class="mb-6">
					This {{ collectionLabelSingular().toLowerCase() }} has been deleted.
				</mcms-alert>
			}

			<!-- Page Header — eyebrow + title + subtitle, matches dashboard/list/edit -->
			<div class="mb-8 flex items-start justify-between gap-4">
				<div class="flex flex-col gap-1.5 min-w-0">
					<span class="mcms-eyebrow">{{ isDeleted() ? 'Trashed' : 'Viewing' }}</span>
					<div class="flex items-center gap-3 flex-wrap">
						<h1 class="mcms-page-title truncate">{{ entityTitle() }}</h1>
						@if (hasVersioning() && entity()) {
							<mcms-publish-controls
								[collection]="collection().slug"
								[documentId]="entityId()"
								[documentLabel]="collectionLabelSingular()"
								[initialStatus]="documentStatus()"
								(statusChanged)="onStatusChanged($event)"
							/>
						}
					</div>
					<p class="mcms-page-subtitle">{{ collectionLabelSingular() }} details — read only.</p>
					<ng-content select="[entityViewHeaderExtra]" />
				</div>
				<div class="flex items-center gap-3">
					@if (isDeleted()) {
						@if (canEdit()) {
							<button mcms-button variant="outline" (click)="onRestoreClick()">Restore</button>
						}
						@if (canDelete()) {
							<button mcms-button variant="destructive" (click)="onForceDeleteClick()">
								Permanently Delete
							</button>
						}
					} @else {
						@if (canEdit()) {
							<button mcms-button variant="outline" (click)="onEditClick()">Edit</button>
						}
						@if (canDelete()) {
							<button mcms-button variant="destructive" (click)="onDeleteClick()">
								{{ hasSoftDelete() ? 'Move to Trash' : 'Delete' }}
							</button>
						}
					}
					@for (action of actions(); track action.id) {
						<button
							mcms-button
							[variant]="action.variant === 'destructive' ? 'destructive' : 'outline'"
							[disabled]="action.disabled ?? false"
							(click)="onActionClick(action)"
						>
							{{ action.label }}
						</button>
					}
				</div>
			</div>

			@if (isLoading()) {
				<div class="border-t border-border">
					@for (_ of [1, 2, 3, 4, 5]; track $index) {
						<div
							class="grid grid-cols-[14rem_1fr] items-baseline gap-x-8 gap-y-1 border-b border-border py-4"
						>
							<mcms-skeleton class="h-3 w-24" />
							<mcms-skeleton class="h-4 w-3/4" />
						</div>
					}
				</div>
			} @else if (loadError()) {
				<mcms-alert variant="destructive">
					{{ loadError() }}
				</mcms-alert>
			} @else if (entity()) {
				@if (isUploadCol() && entityMediaUrl()) {
					<div class="mb-8">
						@if (isEntityImage()) {
							<div class="pointer-events-none">
								<mcms-focal-point-picker
									[imageUrl]="entityMediaUrl()"
									[focalPoint]="entityFocalPoint()"
									[naturalWidth]="entityDimensions().width"
									[naturalHeight]="entityDimensions().height"
									[imageSizes]="viewImageSizes()"
								/>
							</div>
						} @else {
							<mcms-media-preview [media]="entityMediaPreview()" size="xl" />
						}
					</div>
				}
				@if (isUploadCol() && entitySizes()) {
					<div class="mb-8">
						<mcms-image-variants-display [sizes]="entitySizes()" />
					</div>
				}

				<!-- Definition list — narrow label column on the left, value on the right.
				     Each row has a hairline divider; long-form values (rich text, JSON) span
				     the value column and wrap naturally. No card chrome. -->
				<dl class="border-t border-border">
					@for (field of visibleFields(); track field.name) {
						<div
							class="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1 border-b border-border py-4"
						>
							<dt class="mcms-eyebrow pt-0.5">{{ field.label || field.name }}</dt>
							<dd class="min-w-0 text-sm text-foreground">
								@if (field.type === 'blocks') {
									<!-- Block array summary — show each block's type and a one-line preview.
									     Avoids the meaningless "[object Object],[object Object]" you get from
									     coercing a block array to text. -->
									@let blockSummary = getBlocksSummary(field.name);
									@if (blockSummary.length === 0) {
										<span class="text-muted-foreground">No blocks</span>
									} @else {
										<ol class="flex flex-col gap-2 mcms-mono text-2xs">
											@for (b of blockSummary; track $index) {
												<li class="flex items-baseline gap-2 text-foreground/80">
													<span class="text-muted-foreground/70">{{ $index + 1 }}.</span>
													<span class="uppercase tracking-mcms-wide">{{ b.label }}</span>
													@if (b.preview) {
														<span class="font-sans normal-case text-muted-foreground truncate">
															— {{ b.preview }}
														</span>
													}
												</li>
											}
										</ol>
									}
								} @else {
									<mcms-field-display
										[value]="getFieldValue(field.name)"
										[type]="getFieldDisplayType(field)"
										[fieldMeta]="getFieldMeta(field)"
										[numberFormat]="getNumberFormat(field)"
										[dateFormat]="getDateFormat(field)"
									/>
								}
							</dd>
						</div>
					}

					@if (hasTimestamps()) {
						<div
							class="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1 border-b border-border py-4"
						>
							<dt class="mcms-eyebrow pt-0.5">Created</dt>
							<dd class="min-w-0 text-sm text-foreground">
								<mcms-field-display [value]="entity()!['createdAt']" type="datetime" />
							</dd>
						</div>
						<div
							class="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1 border-b border-border py-4"
						>
							<dt class="mcms-eyebrow pt-0.5">Updated</dt>
							<dd class="min-w-0 text-sm text-foreground">
								<mcms-field-display [value]="entity()!['updatedAt']" type="datetime" />
							</dd>
						</div>
					}
				</dl>

				@if (!suppressNavigation()) {
					<div class="mt-8">
						<button
							type="button"
							class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0 cursor-pointer"
							(click)="navigateBack()"
						>
							<span aria-hidden="true">←</span>
							Back to {{ collectionLabel() }}
						</button>
					</div>
				}
			}

			@if (hasVersioning() && entity() && showVersionHistory()) {
				<div class="mt-8">
					<mcms-version-history
						[collection]="collection().slug"
						[documentId]="entityId()"
						[documentLabel]="collectionLabelSingular()"
						(restored)="onVersionRestored()"
					/>
				</div>
			}
		</div>
	`,
})
export class EntityViewWidget<T extends Entity = Entity> {
	private readonly api = injectMomentumAPI();
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly feedback = inject(FeedbackService);
	private readonly router = inject(Router);

	/** The collection configuration */
	readonly collection = input.required<CollectionConfig>();

	/** Entity ID to view */
	readonly entityId = input.required<string>();

	/** Base path for navigation */
	readonly basePath = input('/admin/collections');

	/** Whether to show breadcrumbs */
	readonly showBreadcrumbs = input(true);

	/** Custom field configurations */
	readonly fieldConfigs = input<EntityViewFieldConfig[]>([]);

	/** Additional actions to show */
	readonly actions = input<EntityAction[]>([]);

	/** Whether to show version history (only shown if versioning is enabled) */
	readonly showVersionHistory = input(true);

	/** When true, prevents router navigation (used in entity sheet) */
	readonly suppressNavigation = input(false);

	/** Outputs */
	readonly edit = output<T>();
	readonly statusChanged = output<DocumentStatus>();
	readonly delete_ = output<T>();
	readonly actionClick = output<{ action: EntityAction; entity: T }>();

	/** Internal state */
	readonly entity = signal<T | null>(null);
	readonly isLoading = signal(false);
	readonly loadError = signal<string | null>(null);
	readonly resolvedRelationships = signal<Map<string, string>>(new Map());

	/** Computed collection label */
	readonly collectionLabel = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.plural || col.slug);
	});

	/** Computed collection label singular */
	readonly collectionLabelSingular = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.singular || col.slug);
	});

	/** Entity title (uses title field or ID) */
	readonly entityTitle = computed(() => {
		const e = this.entity();
		if (!e) return 'Loading...';

		// Try common title fields
		const titleFields = ['title', 'name', 'label', 'subject'];
		for (const field of titleFields) {
			if (e[field] && typeof e[field] === 'string') {
				return e[field];
			}
		}

		return `${this.collectionLabelSingular()} ${e.id}`;
	});

	/** Visible fields (excluding hidden ones, flattening layout wrappers) */
	readonly visibleFields = computed((): Field[] => {
		const col = this.collection();
		const configs = this.fieldConfigs();
		const dataFields = flattenDataFields(col.fields);

		return dataFields.filter((field) => {
			// Check custom config
			const config = configs.find((c) => c.field === field.name);
			if (config?.hidden) return false;

			// Check admin hidden
			if (field.admin?.hidden) return false;

			return true;
		});
	});

	/** Whether collection has timestamps */
	readonly hasTimestamps = computed(() => {
		const col = this.collection();
		return (
			col.timestamps === true ||
			(typeof col.timestamps === 'object' && col.timestamps.createdAt !== false)
		);
	});

	/** Dashboard path */
	readonly dashboardPath = computed(() => {
		const base = this.basePath();
		// Remove /collections from base if present
		return base.replace(/\/collections$/, '');
	});

	/** Collection list path */
	readonly collectionListPath = computed(() => {
		return `${this.basePath()}/${this.collection().slug}`;
	});

	/** Whether user can edit */
	readonly canEdit = computed(() => {
		return this.collectionAccess.canUpdate(this.collection().slug);
	});

	/** Whether user can delete */
	readonly canDelete = computed(() => {
		return this.collectionAccess.canDelete(this.collection().slug);
	});

	/** Whether this collection is an upload collection */
	readonly isUploadCol = computed(() => isUploadCollection(this.collection()));

	/** Whether the entity is an image */
	readonly isEntityImage = computed(() => {
		const e = this.entity();
		if (!e) return false;
		const mimeType = e['mimeType'];
		return typeof mimeType === 'string' && mimeType.startsWith('image/');
	});

	/** Media URL for preview */
	readonly entityMediaUrl = computed((): string => {
		const e = this.entity();
		if (!e) return '';
		if (typeof e['url'] === 'string' && e['url']) return e['url'];
		if (typeof e['path'] === 'string' && e['path']) return `/api/media/file/${e['path']}`;
		return '';
	});

	/** Focal point from entity data */
	readonly entityFocalPoint = computed((): { x: number; y: number } => {
		const e = this.entity();
		if (!e) return { x: 0.5, y: 0.5 };
		const fp = e['focalPoint'];
		if (fp != null && typeof fp === 'object' && !Array.isArray(fp)) {
			const obj = fp as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
			const x = obj['x'];
			const y = obj['y'];
			if (typeof x === 'number' && typeof y === 'number') return { x, y };
		}
		return { x: 0.5, y: 0.5 };
	});

	/** Image dimensions from entity data */
	readonly entityDimensions = computed(() => {
		const e = this.entity();
		return {
			width: typeof e?.['width'] === 'number' ? e['width'] : 0,
			height: typeof e?.['height'] === 'number' ? e['height'] : 0,
		};
	});

	/** Image sizes from collection upload config */
	readonly viewImageSizes = computed((): ImageSizeConfig[] => {
		return this.collection().upload?.imageSizes ?? [];
	});

	/** Generated image sizes from entity data */
	readonly entitySizes = computed(() => {
		const e = this.entity();
		if (!e) return null;
		const sizes = e['sizes'];
		if (
			sizes != null &&
			typeof sizes === 'object' &&
			!Array.isArray(sizes) &&
			Object.keys(sizes).length > 0
		) {
			return sizes as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
		}
		return null;
	});

	/** Media preview data for non-image files */
	readonly entityMediaPreview = computed((): MediaPreviewData | null => {
		const e = this.entity();
		if (!e) return null;
		return {
			url: typeof e['url'] === 'string' ? e['url'] : undefined,
			path: typeof e['path'] === 'string' ? e['path'] : undefined,
			mimeType: typeof e['mimeType'] === 'string' ? e['mimeType'] : undefined,
			filename: typeof e['filename'] === 'string' ? e['filename'] : undefined,
			alt: typeof e['alt'] === 'string' ? e['alt'] : undefined,
		};
	});

	/** Whether collection has soft delete enabled */
	readonly hasSoftDelete = computed(() => !!this.collection().softDelete);

	/** Whether the current entity is soft-deleted */
	readonly isDeleted = computed(() => {
		const e = this.entity();
		if (!e || !this.hasSoftDelete()) return false;
		const field = getSoftDeleteField(this.collection());
		return field ? !!e[field] : false;
	});

	/** Whether collection has versioning enabled */
	readonly hasVersioning = computed(() => {
		const col = this.collection();
		return !!col.versions;
	});

	/** Current document status (from entity or default to 'draft') */
	readonly documentStatus = computed((): DocumentStatus => {
		const e = this.entity();
		if (!e) return 'draft';
		const status = e['_status'];
		if (status === 'published') return 'published';
		return 'draft';
	});

	/** Whether this collection has preview enabled */
	readonly hasPreview = computed((): boolean => {
		return !!this.collection().admin?.preview;
	});

	constructor() {
		// Load entity when collection or entityId changes
		effect(() => {
			const col = this.collection();
			const id = this.entityId();

			if (col && id) {
				this.loadEntity(col.slug, id);
			}
		});
	}

	/**
	 * Load entity from API.
	 */
	private async loadEntity(slug: string, id: string): Promise<void> {
		this.isLoading.set(true);
		this.loadError.set(null);

		try {
			const entity = await this.api
				.collection<T>(slug)
				.findById(id, { depth: 1, withDeleted: this.hasSoftDelete() });
			if (!entity) {
				this.loadError.set(`${this.collectionLabelSingular()} not found`);
				this.feedback.entityNotFound(this.collectionLabelSingular());
				return;
			}
			this.entity.set(entity);
			this.resolveRelationships(entity);
		} catch (err) {
			if (err instanceof Error && err.name === 'DocumentNotFoundError') {
				this.loadError.set(`${this.collectionLabelSingular()} not found`);
				this.feedback.entityNotFound(this.collectionLabelSingular());
			} else {
				this.loadError.set('Failed to load data');
				this.feedback.operationFailed('Load failed', err instanceof Error ? err : undefined);
			}
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Get field value from entity, resolving relationship labels.
	 */
	getFieldValue(fieldName: string): unknown {
		const e = this.entity();
		if (!e) return undefined;

		const resolved = this.resolvedRelationships().get(fieldName);
		if (resolved !== undefined) return resolved;

		const value = e[fieldName];

		// Handle populated relationship objects (from depth: 1)
		if (isRecord(value) && 'id' in value) {
			const title = value['title'] ?? value['name'] ?? value['label'];
			if (typeof title === 'string') return title;
			return String(value['id']);
		}

		return value;
	}

	/**
	 * Get field display type from field definition.
	 */
	getFieldDisplayType(field: Field): FieldDisplayType {
		// Check custom config first
		const configs = this.fieldConfigs();
		const config = configs.find((c) => c.field === field.name);
		if (config?.type) return config.type;

		// Map field type to display type
		switch (field.type) {
			case 'text':
			case 'textarea':
				return 'text';
			case 'richText':
				return 'html';
			case 'email':
				return 'email';
			case 'number':
				return 'number';
			case 'checkbox':
				return 'boolean';
			case 'date':
				return 'date';
			case 'select':
			case 'radio':
				return 'badge';
			case 'relationship':
				return 'text';
			case 'array':
				return 'array-table';
			case 'group':
				return 'group';
			case 'json':
				return 'json';
			default:
				return 'text';
		}
	}

	/**
	 * Get sub-field metadata for group and array field types.
	 */
	getFieldMeta(field: Field): FieldDisplayFieldMeta[] {
		if (field.type === 'group' || field.type === 'array') {
			return field.fields
				.filter((f) => !f.admin?.hidden)
				.map((f) => ({
					name: f.name,
					label: f.label ?? humanizeFieldName(f.name),
					type: f.type,
				}));
		}
		return [];
	}

	/**
	 * Get number format config from field definition.
	 */
	getNumberFormat(field: Field): FieldDisplayNumberFormat | undefined {
		if (field.type === 'number' && field.displayFormat) {
			return field.displayFormat;
		}
		return undefined;
	}

	/**
	 * Get date format config from field definition.
	 */
	getDateFormat(field: Field): FieldDisplayDateFormat | undefined {
		if (field.type === 'date' && field.displayFormat) {
			return field.displayFormat;
		}
		return undefined;
	}

	/**
	 * Render a blocks-array field as a typed list. Each entry shows the block's type
	 * label plus a one-line preview (first text-ish field's value, truncated). Replaces
	 * the meaningless `[object Object],[object Object]` you'd get from coercing a block
	 * array to text. Returns [] for fields that aren't blocks or have no data.
	 */
	getBlocksSummary(fieldName: string): Array<{ label: string; preview: string }> {
		const field = this.visibleFields().find((f) => f.name === fieldName);
		if (!field || field.type !== 'blocks') return [];
		const value = this.getFieldValue(fieldName);
		if (!Array.isArray(value)) return [];

		const blockDefs = new Map<string, { label: string; previewField?: string }>();
		for (const def of field.blocks) {
			const previewField = def.fields.find(
				(f) => f.type === 'text' || f.type === 'textarea' || f.type === 'richText',
			)?.name;
			blockDefs.set(def.slug, {
				label: def.labels?.singular || humanizeFieldName(def.slug),
				previewField,
			});
		}

		return value.map((item: unknown) => {
			if (!isRecord(item) || typeof item['blockType'] !== 'string') {
				return { label: 'Unknown block', preview: '' };
			}
			const blockType = item['blockType'];
			const def = blockDefs.get(blockType);
			const label = def?.label ?? blockType;
			const rawPreview = def?.previewField ? item[def.previewField] : undefined;
			let preview = '';
			if (typeof rawPreview === 'string') {
				preview = rawPreview.replace(/<[^>]+>/g, '').trim();
			}
			if (preview.length > 80) preview = preview.slice(0, 77) + '…';
			return { label, preview };
		});
	}

	/**
	 * Handle edit button click.
	 */
	onEditClick(): void {
		const e = this.entity();
		if (e) {
			this.edit.emit(e);
			if (!this.suppressNavigation()) {
				this.router.navigate([this.basePath(), this.collection().slug, e.id, 'edit']);
			}
		}
	}

	/**
	 * Handle delete button click.
	 */
	async onDeleteClick(): Promise<void> {
		const e = this.entity();
		if (!e) return;

		const entityTitle = this.entityTitle();
		const confirmed = await this.feedback.confirmDelete(
			this.collectionLabelSingular(),
			entityTitle !== `${this.collectionLabelSingular()} ${e.id}` ? entityTitle : undefined,
		);

		if (confirmed) {
			try {
				await this.api.collection(this.collection().slug).delete(String(e.id));
				this.delete_.emit(e);
				this.navigateBack();
			} catch {
				// Error handled by crudToastInterceptor
			}
		}
	}

	async onRestoreClick(): Promise<void> {
		const e = this.entity();
		if (!e) return;

		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T extends Entity, safe cast for API call
			const restored = (await this.api
				.collection(this.collection().slug)
				.restore(String(e.id))) as T;
			this.entity.set(restored);
		} catch {
			// Error handled by crudToastInterceptor
		}
	}

	async onForceDeleteClick(): Promise<void> {
		const e = this.entity();
		if (!e) return;

		const entityTitle = this.entityTitle();
		const confirmed = await this.feedback.confirmDelete(
			this.collectionLabelSingular(),
			entityTitle !== `${this.collectionLabelSingular()} ${e.id}` ? entityTitle : undefined,
		);

		if (confirmed) {
			try {
				await this.api.collection(this.collection().slug).forceDelete(String(e.id));
				this.delete_.emit(e);
				this.navigateBack();
			} catch {
				// Error handled by crudToastInterceptor
			}
		}
	}

	/**
	 * Handle custom action click.
	 */
	onActionClick(action: EntityAction): void {
		const e = this.entity();
		if (e) {
			this.actionClick.emit({ action, entity: e });
		}
	}

	/**
	 * Navigate back to collection list.
	 */
	navigateBack(): void {
		if (!this.suppressNavigation()) {
			this.router.navigate([this.basePath(), this.collection().slug]);
		}
	}

	/**
	 * Handle status change from publish controls.
	 */
	onStatusChanged(status: DocumentStatus): void {
		// Update the entity's status in the local state
		const e = this.entity();
		if (e) {
			this.entity.set({ ...e, _status: status });
		}
		this.statusChanged.emit(status);
	}

	/**
	 * Handle version restoration.
	 */
	onVersionRestored(): void {
		// Reload the entity to get the restored data
		this.loadEntity(this.collection().slug, this.entityId());
	}

	/**
	 * Resolve relationship and upload field values from IDs to display labels.
	 */
	private resolveRelationships(entity: T): void {
		const fields = flattenDataFields(this.collection().fields);
		const resolved = new Map<string, string>();

		const promises: Promise<void>[] = [];

		for (const field of fields) {
			if (field.type === 'relationship') {
				const rawValue = entity[field.name];
				if (!rawValue || typeof rawValue !== 'string') continue;

				const config = field.collection();
				if (!isRecord(config) || typeof config['slug'] !== 'string') continue;

				const relSlug = config['slug'];
				const titleField = getTitleField(config);

				promises.push(
					this.api
						.collection<Record<string, unknown>>(relSlug)
						.findById(rawValue)
						.then((doc) => {
							if (doc) {
								if (titleField !== 'id') {
									const titleValue = doc[titleField];
									if (typeof titleValue === 'string') {
										resolved.set(field.name, titleValue);
										return;
									}
								}
								resolved.set(field.name, String(doc['id'] ?? rawValue));
							} else {
								resolved.set(field.name, 'Unknown');
							}
						})
						.catch(() => {
							resolved.set(field.name, 'Unknown');
						}),
				);
			} else if (field.type === 'upload') {
				const rawValue = entity[field.name];
				if (!rawValue || typeof rawValue !== 'string') continue;

				const relSlug = field.relationTo;

				promises.push(
					this.api
						.collection<Record<string, unknown>>(relSlug)
						.findById(rawValue)
						.then((doc) => {
							if (doc && typeof doc['filename'] === 'string') {
								resolved.set(field.name, doc['filename']);
							} else {
								resolved.set(field.name, rawValue);
							}
						})
						.catch(() => {
							resolved.set(field.name, rawValue);
						}),
				);
			}
		}

		if (promises.length > 0) {
			Promise.all(promises).then(() => {
				this.resolvedRelationships.set(resolved);
			});
		}
	}
}

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
import type { CollectionConfig, Field, DocumentStatus } from '@momentum-cms/core';
import {
	Card,
	CardHeader,
	CardContent,
	CardFooter,
	Button,
	Alert,
	Skeleton,
	FieldDisplay,
	Breadcrumbs,
	BreadcrumbItem,
	BreadcrumbSeparator,
} from '@momentum-cms/ui';
import type { FieldDisplayType } from '@momentum-cms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';
import type { Entity, EntityAction } from '../widget.types';
import type { EntityViewFieldConfig } from './entity-view.types';
import { VersionHistoryWidget } from '../version-history/version-history.component';
import { PublishControlsWidget } from '../publish-controls/publish-controls.component';

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
		Card,
		CardHeader,
		CardContent,
		CardFooter,
		Button,
		Alert,
		Skeleton,
		FieldDisplay,
		Breadcrumbs,
		BreadcrumbItem,
		BreadcrumbSeparator,
		VersionHistoryWidget,
		PublishControlsWidget,
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

			<!-- Page Header -->
			<div class="mb-8 flex items-start justify-between">
				<div>
					<div class="flex items-center gap-3">
						<h1 class="text-2xl font-semibold tracking-tight">{{ entityTitle() }}</h1>
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
					<p class="mt-1 text-muted-foreground">
						Viewing {{ collectionLabelSingular().toLowerCase() }} details
					</p>
				</div>
				<div class="flex items-center gap-3">
					@if (canEdit()) {
						<button mcms-button variant="outline" (click)="onEditClick()">Edit</button>
					}
					@if (canDelete()) {
						<button mcms-button variant="destructive" (click)="onDeleteClick()">Delete</button>
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

			<mcms-card>
				<mcms-card-content class="pt-6">
					@if (isLoading()) {
						<div class="grid gap-6 md:grid-cols-2">
							@for (_ of [1, 2, 3, 4]; track $index) {
								<div class="space-y-2">
									<mcms-skeleton class="h-4 w-24" />
									<mcms-skeleton class="h-6 w-full" />
								</div>
							}
						</div>
					} @else if (loadError()) {
						<mcms-alert variant="destructive">
							{{ loadError() }}
						</mcms-alert>
					} @else if (entity()) {
						<div class="grid gap-6 md:grid-cols-2">
							@for (field of visibleFields(); track field.name) {
								<mcms-field-display
									[value]="getFieldValue(field.name)"
									[type]="getFieldDisplayType(field)"
									[label]="field.label || field.name"
								/>
							}

							@if (hasTimestamps()) {
								<mcms-field-display
									[value]="entity()!['createdAt']"
									type="datetime"
									label="Created At"
								/>
								<mcms-field-display
									[value]="entity()!['updatedAt']"
									type="datetime"
									label="Updated At"
								/>
							}
						</div>
					}
				</mcms-card-content>

				<mcms-card-footer class="flex justify-start border-t bg-muted/50 px-6 py-4">
					<button mcms-button variant="outline" (click)="navigateBack()">
						← Back to {{ collectionLabel() }}
					</button>
				</mcms-card-footer>
			</mcms-card>

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

	/** Outputs */
	readonly edit = output<T>();
	readonly statusChanged = output<DocumentStatus>();
	readonly delete_ = output<T>();
	readonly actionClick = output<{ action: EntityAction; entity: T }>();

	/** Internal state */
	readonly entity = signal<T | null>(null);
	readonly isLoading = signal(false);
	readonly loadError = signal<string | null>(null);

	/** Computed collection label */
	readonly collectionLabel = computed(() => {
		const col = this.collection();
		return col.labels?.plural || col.slug;
	});

	/** Computed collection label singular */
	readonly collectionLabelSingular = computed(() => {
		const col = this.collection();
		return col.labels?.singular || col.slug;
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

	/** Visible fields (excluding hidden ones) */
	readonly visibleFields = computed((): Field[] => {
		const col = this.collection();
		const configs = this.fieldConfigs();

		return col.fields.filter((field) => {
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
			const entity = await this.api.collection<T>(slug).findById(id);
			if (entity) {
				this.entity.set(entity);
			} else {
				this.loadError.set(`${this.collectionLabelSingular()} not found`);
				this.feedback.entityNotFound(this.collectionLabelSingular());
			}
		} catch (err) {
			this.loadError.set('Failed to load data');
			this.feedback.operationFailed('Load failed', err instanceof Error ? err : undefined);
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Get field value from entity.
	 */
	getFieldValue(fieldName: string): unknown {
		const e = this.entity();
		if (!e) return undefined;
		return e[fieldName];
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
			case 'richText':
				return 'text';
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
				return 'list';
			case 'group':
			case 'json':
				return 'json';
			default:
				return 'text';
		}
	}

	/**
	 * Handle edit button click.
	 */
	onEditClick(): void {
		const e = this.entity();
		if (e) {
			this.edit.emit(e);
			this.router.navigate([`${this.collectionListPath()}/${e.id}/edit`]);
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
				this.feedback.entityDeleted(this.collectionLabelSingular());
				this.navigateBack();
			} catch (err) {
				this.feedback.operationFailed('Delete failed', err instanceof Error ? err : undefined);
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
		this.router.navigate([this.collectionListPath()]);
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
}

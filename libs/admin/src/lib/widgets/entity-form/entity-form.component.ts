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
import type { CollectionConfig, Field } from '@momentum-cms/core';
import { flattenDataFields } from '@momentum-cms/core';
import {
	Card,
	CardHeader,
	CardContent,
	CardFooter,
	Button,
	Spinner,
	Alert,
	Breadcrumbs,
	BreadcrumbItem,
	BreadcrumbSeparator,
} from '@momentum-cms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { VersionService } from '../../services/version.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';
import type { Entity } from '../widget.types';
import {
	type EntityFormMode,
	type FieldError,
	type FieldChangeEvent,
	createInitialFormData,
	setValueAtPath,
	getValueAtPath,
} from './entity-form.types';
import { FieldRenderer } from './field-renderers/field-renderer.component';
import { VersionHistoryWidget } from '../version-history/version-history.component';

/**
 * Entity Form Widget
 *
 * Dynamic form for create/edit operations, connected to Momentum API.
 *
 * @example
 * ```html
 * <mcms-entity-form
 *   [collection]="postsCollection"
 *   entityId="123"
 *   mode="edit"
 *   (saved)="onSaved($event)"
 *   (cancelled)="onCancel()"
 * />
 * ```
 */
@Component({
	selector: 'mcms-entity-form',
	imports: [
		Card,
		CardHeader,
		CardContent,
		CardFooter,
		Button,
		Spinner,
		Alert,
		FieldRenderer,
		Breadcrumbs,
		BreadcrumbItem,
		BreadcrumbSeparator,
		VersionHistoryWidget,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="max-w-3xl">
			@if (showBreadcrumbs()) {
				<mcms-breadcrumbs class="mb-6">
					<mcms-breadcrumb-item [href]="dashboardPath()">Dashboard</mcms-breadcrumb-item>
					<mcms-breadcrumb-separator />
					<mcms-breadcrumb-item [href]="collectionListPath()">{{
						collectionLabel()
					}}</mcms-breadcrumb-item>
					<mcms-breadcrumb-separator />
					<mcms-breadcrumb-item [current]="true">{{ pageTitle() }}</mcms-breadcrumb-item>
				</mcms-breadcrumbs>
			}

			<!-- Page Header -->
			<div class="mb-8">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h1 class="text-2xl font-semibold tracking-tight">
							@if (mode() === 'create') {
								Create {{ collectionLabelSingular() }}
							} @else if (mode() === 'edit') {
								Edit {{ collectionLabelSingular() }}
							} @else {
								View {{ collectionLabelSingular() }}
							}
						</h1>
						<p class="mt-1 text-muted-foreground">
							@if (mode() === 'create') {
								Add a new {{ collectionLabelSingular().toLowerCase() }} to your collection.
							} @else if (mode() === 'edit') {
								Update the {{ collectionLabelSingular().toLowerCase() }} details below.
							} @else {
								Viewing {{ collectionLabelSingular().toLowerCase() }} details.
							}
						</p>
					</div>
				</div>
			</div>

			<mcms-card>
				<mcms-card-content class="pt-6">
					@if (isLoading()) {
						<div class="flex items-center justify-center py-12">
							<mcms-spinner size="lg" />
						</div>
					} @else {
						@if (formError()) {
							<mcms-alert variant="destructive" class="mb-6" role="alert" aria-live="assertive">
								{{ formError() }}
							</mcms-alert>
						}

						<div class="space-y-6">
							@for (field of visibleFields(); track field.name) {
								<mcms-field-renderer
									[field]="field"
									[value]="getFieldValue(field.name)"
									[mode]="mode()"
									[collection]="collection()"
									[formData]="formData()"
									[path]="field.name"
									[error]="getFieldError(field.name)"
									(fieldChange)="onFieldChange($event)"
								/>
							}
						</div>
					}
				</mcms-card-content>

				<mcms-card-footer class="flex justify-end gap-3 border-t bg-muted/50 px-6 py-4">
					@if (mode() !== 'view') {
						<button
							mcms-button
							variant="outline"
							[disabled]="isSubmitting() || isSavingDraft()"
							(click)="onCancel()"
						>
							Cancel
						</button>
						@if (canSaveDraft()) {
							<button
								mcms-button
								variant="outline"
								[disabled]="isSubmitting() || isSavingDraft()"
								(click)="onSaveDraft()"
							>
								@if (isSavingDraft()) {
									<mcms-spinner size="sm" class="mr-2" />
								}
								Save Draft
							</button>
						}
						<button
							mcms-button
							variant="primary"
							[disabled]="isSubmitting() || isSavingDraft() || !canSubmit()"
							(click)="onSubmit()"
						>
							@if (isSubmitting()) {
								<mcms-spinner size="sm" class="mr-2" />
							}
							{{ mode() === 'create' ? 'Create' : 'Save Changes' }}
						</button>
					} @else {
						@if (canEdit()) {
							<button mcms-button variant="primary" (click)="switchToEdit()">Edit</button>
						}
					}
				</mcms-card-footer>
			</mcms-card>

			@if (hasVersioning() && mode() === 'edit' && entityId()) {
				<div class="mt-8">
					<mcms-version-history
						[collection]="collection().slug"
						[documentId]="entityId()!"
						[documentLabel]="collectionLabelSingular()"
						(restored)="onVersionRestored()"
					/>
				</div>
			}
		</div>
	`,
})
export class EntityFormWidget<T extends Entity = Entity> {
	private readonly api = injectMomentumAPI();
	private readonly versionService = inject(VersionService);
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly feedback = inject(FeedbackService);
	private readonly router = inject(Router);

	/** The collection configuration */
	readonly collection = input.required<CollectionConfig>();

	/** Entity ID for edit mode (undefined for create) */
	readonly entityId = input<string | undefined>(undefined);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Base path for navigation */
	readonly basePath = input('/admin/collections');

	/** Whether to show breadcrumbs */
	readonly showBreadcrumbs = input(true);

	/** Outputs */
	readonly saved = output<T>();
	readonly cancelled = output<void>();
	readonly saveError = output<Error>();
	readonly modeChange = output<EntityFormMode>();
	readonly draftSaved = output<void>();

	/** Internal state */
	readonly formData = signal<Record<string, unknown>>({});
	readonly originalData = signal<T | null>(null);
	readonly isLoading = signal(false);
	readonly isSubmitting = signal(false);
	readonly isSavingDraft = signal(false);
	readonly errors = signal<FieldError[]>([]);
	readonly formError = signal<string | null>(null);

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

	/** Dashboard path (remove /collections from base path) */
	readonly dashboardPath = computed(() => {
		const base = this.basePath();
		return base.replace(/\/collections$/, '');
	});

	/** Collection list path */
	readonly collectionListPath = computed(() => {
		return `${this.basePath()}/${this.collection().slug}`;
	});

	/** Page title for breadcrumb */
	readonly pageTitle = computed(() => {
		const currentMode = this.mode();
		if (currentMode === 'create') {
			return `Create ${this.collectionLabelSingular()}`;
		}

		// For edit mode, try to show entity title
		const data = this.formData();
		const titleFields = ['title', 'name', 'label', 'subject'];
		for (const field of titleFields) {
			if (data[field] && typeof data[field] === 'string') {
				return data[field];
			}
		}

		return `Edit ${this.collectionLabelSingular()}`;
	});

	/** Visible fields (excluding hidden ones) */
	readonly visibleFields = computed((): Field[] => {
		const col = this.collection();
		return col.fields.filter((field) => !field.admin?.hidden);
	});

	/** Whether user can edit */
	readonly canEdit = computed(() => {
		return this.collectionAccess.canUpdate(this.collection().slug);
	});

	/** Whether form can be submitted */
	readonly canSubmit = computed(() => {
		// Check required fields have values (flatten through layout fields)
		const data = this.formData();
		const col = this.collection();
		const dataFields = flattenDataFields(col.fields);

		for (const field of dataFields) {
			if (field.required) {
				const value = getValueAtPath(data, field.name);
				if (value === null || value === undefined || value === '') {
					return false;
				}
			}
		}

		return true;
	});

	/** Whether collection has versioning with drafts enabled */
	readonly hasVersioning = computed(() => {
		const col = this.collection();
		const versions = col.versions;
		if (typeof versions === 'object' && versions !== null) {
			return !!versions.drafts;
		}
		return false;
	});

	/** Whether draft save is available (edit mode with existing entity) */
	readonly canSaveDraft = computed(() => {
		return this.hasVersioning() && this.mode() === 'edit' && !!this.entityId();
	});

	constructor() {
		// Initialize form data when collection changes
		effect(() => {
			const col = this.collection();
			const id = this.entityId();
			const currentMode = this.mode();

			if (col) {
				if (currentMode === 'create' || !id) {
					// Create mode - use initial data
					this.formData.set(createInitialFormData(col));
				} else {
					// Edit/view mode - load entity
					this.loadEntity(col.slug, id);
				}
			}
		});
	}

	/**
	 * Load entity for edit mode.
	 */
	private async loadEntity(slug: string, id: string): Promise<void> {
		this.isLoading.set(true);
		this.formError.set(null);

		try {
			const entity = await this.api.collection<T>(slug).findById(id);
			if (entity) {
				this.originalData.set(entity);
				this.formData.set({ ...entity });
			} else {
				this.formError.set(`${this.collectionLabelSingular()} not found`);
				this.feedback.entityNotFound(this.collectionLabelSingular());
			}
		} catch (err) {
			this.formError.set('Failed to load data');
			this.saveError.emit(err instanceof Error ? err : new Error('Failed to load data'));
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Get field value from form data.
	 */
	getFieldValue(fieldName: string): unknown {
		return getValueAtPath(this.formData(), fieldName);
	}

	/**
	 * Get field error if any.
	 */
	getFieldError(fieldName: string): string | undefined {
		return this.errors().find((e) => e.field === fieldName)?.message;
	}

	/**
	 * Handle field change.
	 */
	onFieldChange(event: FieldChangeEvent): void {
		const currentData = this.formData();
		const newData = setValueAtPath(currentData, event.path, event.value);
		this.formData.set(newData);

		// Clear field error on change
		this.errors.update((errors) => errors.filter((e) => e.field !== event.path));
	}

	/**
	 * Handle form submission.
	 */
	async onSubmit(): Promise<void> {
		if (this.isSubmitting() || !this.canSubmit()) return;

		this.isSubmitting.set(true);
		this.formError.set(null);
		this.errors.set([]);

		try {
			const slug = this.collection().slug;
			const data = this.formData();
			let result: T;

			if (this.mode() === 'create') {
				// Form data matches entity structure - assertion is safe
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				result = await this.api.collection<T>(slug).create(data as Partial<T>);
				this.feedback.entityCreated(this.collectionLabelSingular());
			} else {
				const id = this.entityId();
				if (!id) throw new Error('Entity ID required for update');
				// Form data matches entity structure - assertion is safe
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				result = await this.api.collection<T>(slug).update(id, data as Partial<T>);
				this.feedback.entityUpdated(this.collectionLabelSingular());
			}

			this.saved.emit(result);

			// Navigate back to list
			const listPath = `${this.basePath()}/${slug}`;
			this.router.navigate([listPath]);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Save failed';
			this.formError.set(errorMessage);
			this.feedback.operationFailed('Save failed', err instanceof Error ? err : undefined);
			this.saveError.emit(err instanceof Error ? err : new Error(errorMessage));
		} finally {
			this.isSubmitting.set(false);
		}
	}

	/**
	 * Handle cancel.
	 */
	onCancel(): void {
		this.cancelled.emit();

		// Navigate back to list
		const listPath = `${this.basePath()}/${this.collection().slug}`;
		this.router.navigate([listPath]);
	}

	/**
	 * Switch from view to edit mode.
	 */
	switchToEdit(): void {
		this.modeChange.emit('edit');
	}

	/**
	 * Handle version restore - reload the entity data.
	 */
	onVersionRestored(): void {
		const id = this.entityId();
		if (id) {
			this.loadEntity(this.collection().slug, id);
		}
	}

	/**
	 * Save form data as a draft.
	 */
	async onSaveDraft(): Promise<void> {
		const id = this.entityId();
		if (!id || this.isSavingDraft()) return;

		this.isSavingDraft.set(true);
		this.formError.set(null);

		try {
			const slug = this.collection().slug;
			const data = this.formData();

			await this.versionService.saveDraft(slug, id, data);
			this.feedback.draftSaved();
			this.draftSaved.emit();
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to save draft';
			this.formError.set(errorMessage);
			this.feedback.operationFailed('Draft save failed', err instanceof Error ? err : undefined);
		} finally {
			this.isSavingDraft.set(false);
		}
	}
}

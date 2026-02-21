import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	Injector,
	input,
	output,
	runInInjectionContext,
	signal,
	untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { form, submit } from '@angular/forms/signals';
import type { CollectionConfig, Field } from '@momentumcms/core';
import { flattenDataFields, humanizeFieldName, isUploadCollection } from '@momentumcms/core';
import {
	Card,
	CardContent,
	CardFooter,
	Button,
	Spinner,
	Alert,
	Breadcrumbs,
	BreadcrumbItem,
	BreadcrumbSeparator,
} from '@momentumcms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { UploadService, type UploadProgress } from '../../services/upload.service';
import { VersionService } from '../../services/version.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';
import type { Entity } from '../widget.types';
import { type EntityFormMode, createInitialFormData } from './entity-form.types';
import { applyCollectionSchema } from './form-schema-builder';
import { FieldRenderer } from './field-renderers/field-renderer.component';
import { VersionHistoryWidget } from '../version-history/version-history.component';
import { CollectionUploadZoneComponent } from './collection-upload-zone.component';

/**
 * Entity Form Widget
 *
 * Dynamic form for create/edit operations using Angular Signal Forms.
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
		CollectionUploadZoneComponent,
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
							@if (isGlobal()) {
								{{ collectionLabelSingular() }}
							} @else if (mode() === 'create') {
								Create {{ collectionLabelSingular() }}
							} @else if (mode() === 'edit') {
								Edit {{ collectionLabelSingular() }}
							} @else {
								View {{ collectionLabelSingular() }}
							}
						</h1>
						<p class="mt-1 text-muted-foreground">
							@if (isGlobal()) {
								Manage {{ collectionLabelSingular().toLowerCase() }} settings.
							} @else if (mode() === 'create') {
								Add a new {{ collectionLabelSingular().toLowerCase() }} to your collection.
							} @else if (mode() === 'edit') {
								Update the {{ collectionLabelSingular().toLowerCase() }} details below.
							} @else {
								Viewing {{ collectionLabelSingular().toLowerCase() }} details.
							}
						</p>
					</div>
				</div>
				<ng-content select="[entityFormHeaderExtra]" />
			</div>

			<mcms-card>
				<mcms-card-content>
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

						@if (isUploadCol()) {
							<mcms-collection-upload-zone
								[uploadConfig]="collection().upload"
								[pendingFile]="pendingFile()"
								[existingMedia]="mode() === 'edit' && !pendingFile() ? formModel() : null"
								[disabled]="mode() === 'view'"
								[isUploading]="isUploadingFile()"
								[uploadProgress]="uploadFileProgress()"
								[error]="uploadFileError()"
								(fileSelected)="onFileSelected($event)"
								(fileRemoved)="onFileRemoved()"
							/>
						}

						<div class="space-y-6">
							@for (field of visibleFields(); track field.name) {
								<mcms-field-renderer
									[field]="field"
									[formNode]="getFormNode(field.name)"
									[formTree]="entityForm()"
									[formModel]="formModel()"
									[mode]="mode()"
									[path]="field.name"
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
							[disabled]="isSubmitting() || isSavingDraft()"
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
	private readonly injector = inject(Injector);
	private readonly uploadService = inject(UploadService);
	private readonly versionService = inject(VersionService);
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly feedback = inject(FeedbackService);
	private readonly router = inject(Router);
	private readonly liveAnnouncer = inject(LiveAnnouncer);

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

	/** When true, prevents router navigation after save/cancel (used in entity sheet) */
	readonly suppressNavigation = input(false);

	/** When true, uses the global API instead of collection API (singleton mode) */
	readonly isGlobal = input(false);

	/** The global slug (used when isGlobal is true) */
	readonly globalSlug = input<string | undefined>(undefined);

	/** Outputs */
	readonly saved = output<T>();
	readonly cancelled = output<void>();
	readonly saveError = output<Error>();
	readonly modeChange = output<EntityFormMode>();
	readonly draftSaved = output<void>();

	/** Model signal — the single source of truth for form data */
	readonly formModel = signal<Record<string, unknown>>({});

	/** Alias for backward compatibility (CollectionEditPage reads formData) */
	readonly formData = this.formModel;

	/** Signal forms tree — created once when collection is available */
	readonly entityForm = signal<ReturnType<typeof form<Record<string, unknown>>> | null>(null);

	/** Original data for edit mode */
	readonly originalData = signal<T | null>(null);

	/** UI state */
	readonly isLoading = signal(false);
	readonly isSubmitting = signal(false);
	readonly isSavingDraft = signal(false);
	readonly formError = signal<string | null>(null);

	/** Upload collection state */
	readonly pendingFile = signal<File | null>(null);
	readonly isUploadingFile = signal(false);
	readonly uploadFileProgress = signal(0);
	readonly uploadFileError = signal<string | null>(null);

	/** Whether the collection is an upload collection */
	readonly isUploadCol = computed(() => isUploadCollection(this.collection()));

	/** Whether the form has been set up */
	private formCreated = false;

	/** Whether the form has unsaved changes (from signal forms dirty tracking) */
	readonly isDirty = computed(() => {
		const ef = this.entityForm();
		return ef ? ef().dirty() : false;
	});

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
		if (this.isGlobal()) {
			return this.collectionLabelSingular();
		}

		const currentMode = this.mode();
		if (currentMode === 'create') {
			return `Create ${this.collectionLabelSingular()}`;
		}

		const data = this.formModel();
		const titleFields = ['title', 'name', 'label', 'subject'];
		for (const field of titleFields) {
			if (data[field] && typeof data[field] === 'string') {
				return data[field];
			}
		}

		return `Edit ${this.collectionLabelSingular()}`;
	});

	/** Visible fields (excluding hidden ones and those failing admin.condition) */
	readonly visibleFields = computed((): Field[] => {
		const col = this.collection();
		const data = this.formModel();
		return col.fields.filter((field) => {
			if (field.admin?.hidden) return false;
			if (field.admin?.condition && !field.admin.condition(data)) return false;
			return true;
		});
	});

	/** Whether user can edit */
	readonly canEdit = computed(() => {
		return this.collectionAccess.canUpdate(this.collection().slug);
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
		effect(() => {
			const col = this.collection();
			const id = this.entityId();
			const currentMode = this.mode();
			const globalMode = this.isGlobal();
			const gSlug = this.globalSlug();

			if (col) {
				// Create the signal forms tree once per collection
				if (!this.formCreated) {
					this.formCreated = true;
					this.formModel.set(createInitialFormData(col));
					const formModelRef = this.formModel;
					const f = untracked(() =>
						runInInjectionContext(this.injector, () =>
							form(this.formModel, (tree) => {
								applyCollectionSchema(
									col.fields,
									// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- FieldTree generic not exported
									tree as unknown as Record<string, unknown>,
									() => formModelRef(),
								);
							}),
						),
					);
					this.entityForm.set(f);
				}

				if (globalMode && gSlug) {
					// Global mode: always load the singleton
					this.loadGlobal(gSlug);
				} else if (currentMode === 'create' || !id) {
					this.formModel.set(createInitialFormData(col));
					const ef = this.entityForm();
					if (ef) ef().reset();
				} else {
					this.loadEntity(col.slug, id);
				}
			}
		});
	}

	/**
	 * Get a FieldTree node for a top-level field by name.
	 */
	getFormNode(fieldName: string): unknown {
		const ef = this.entityForm();
		if (!ef) return null;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- FieldTree generic not exported
		return (ef as unknown as Record<string, unknown>)[fieldName] ?? null;
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
				this.formModel.set({ ...entity });
				const ef = this.entityForm();
				if (ef) ef().reset();
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
	 * Load global singleton document.
	 */
	private async loadGlobal(slug: string): Promise<void> {
		this.isLoading.set(true);
		this.formError.set(null);

		try {
			const data = await this.api.global<T>(slug).findOne();
			if (data) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				this.originalData.set(data as T);
				// Merge API data with initial field defaults so all field keys exist in the model.
				// Auto-created globals only have metadata (slug, timestamps) — without merging,
				// signal-forms can't update fields that don't exist in the model.
				const initial = createInitialFormData(this.collection());
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				this.formModel.set({ ...initial, ...(data as Record<string, unknown>) });
				const ef = this.entityForm();
				if (ef) ef().reset();
			}
		} catch (err) {
			this.formError.set('Failed to load data');
			this.saveError.emit(err instanceof Error ? err : new Error('Failed to load data'));
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Handle file selected in the upload zone.
	 * Auto-populates metadata fields in the form model.
	 */
	onFileSelected(file: File): void {
		this.pendingFile.set(file);
		this.uploadFileError.set(null);

		// Validate file against collection upload config
		const uploadConfig = this.collection().upload;
		if (uploadConfig) {
			// Validate size
			if (uploadConfig.maxFileSize && file.size > uploadConfig.maxFileSize) {
				this.uploadFileError.set(`File size exceeds maximum allowed size`);
				this.pendingFile.set(null);
				return;
			}

			// Validate MIME type
			if (uploadConfig.mimeTypes && uploadConfig.mimeTypes.length > 0) {
				const isAllowed = uploadConfig.mimeTypes.some((pattern) => {
					if (pattern.endsWith('/*')) {
						const prefix = pattern.slice(0, -1);
						return file.type.startsWith(prefix);
					}
					return file.type === pattern;
				});
				if (!isAllowed) {
					this.uploadFileError.set(`File type "${file.type}" is not allowed`);
					this.pendingFile.set(null);
					return;
				}
			}
		}

		// Auto-populate metadata fields in form model
		const data = { ...this.formModel() };
		data['filename'] = file.name;
		data['mimeType'] = file.type;
		data['filesize'] = file.size;
		this.formModel.set(data);
	}

	/**
	 * Handle file removed from the upload zone.
	 */
	onFileRemoved(): void {
		this.pendingFile.set(null);
		this.uploadFileError.set(null);

		// Clear auto-populated metadata
		const data = { ...this.formModel() };
		data['filename'] = '';
		data['mimeType'] = '';
		data['filesize'] = null;
		this.formModel.set(data);
	}

	/**
	 * Handle form submission using Angular Signal Forms submit().
	 * submit() marks all fields as touched, then only calls the callback if valid.
	 * For upload collections with a pending file, uses multipart upload via UploadService.
	 */
	async onSubmit(): Promise<void> {
		const ef = this.entityForm();
		if (!ef || this.isSubmitting()) return;

		let submitted = false;

		await submit(ef, async () => {
			submitted = true;
			this.isSubmitting.set(true);
			this.formError.set(null);

			try {
				const slug = this.collection().slug;
				const data = this.normalizeUploadFieldValues(this.formModel());
				let result: T;

				if (this.isGlobal()) {
					// Global mode: always update (singleton)
					const gSlug = this.globalSlug() ?? slug;
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result = await this.api.global<T>(gSlug).update(data as Partial<T>);
				} else if (this.isUploadCol() && this.pendingFile()) {
					// Upload collection with a pending file: multipart upload
					result = await this.submitUploadCollection(slug, data);
				} else if (this.mode() === 'create') {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result = await this.api.collection<T>(slug).create(data as Partial<T>);
				} else {
					const id = this.entityId();
					if (!id) throw new Error('Entity ID required for update');
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result = await this.api.collection<T>(slug).update(id, data as Partial<T>);
				}

				this.originalData.set(result);
				this.formModel.set({ ...result });
				this.pendingFile.set(null);
				ef().reset();
				this.saved.emit(result);

				if (!this.suppressNavigation() && !this.isGlobal()) {
					const listPath = `${this.basePath()}/${slug}`;
					this.router.navigate([listPath]);
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Save failed';
				this.formError.set(errorMessage);
				// Error toast handled by crudToastInterceptor
				this.saveError.emit(err instanceof Error ? err : new Error(errorMessage));
			} finally {
				this.isSubmitting.set(false);
				this.isUploadingFile.set(false);
			}
		});

		// submit() didn't call the callback — form is invalid
		if (!submitted) {
			this.formError.set('Please fix the errors above before submitting.');
			void this.liveAnnouncer.announce(
				'Form submission failed. Please fix the errors above before submitting.',
				'assertive',
			);
		}
	}

	/**
	 * For upload/relationship fields, the form may store a full document object
	 * (e.g., after upload completes) but the DB expects just the UUID.
	 * Extract the `id` property from any upload field values that are objects.
	 */
	private normalizeUploadFieldValues(data: Record<string, unknown>): Record<string, unknown> {
		const fields = flattenDataFields(this.collection().fields);
		const result = { ...data };

		for (const field of fields) {
			if (field.type === 'upload' && result[field.name] != null) {
				const val = result[field.name];
				if (typeof val === 'object' && val !== null) {
					const obj = val as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
					if (typeof obj['id'] === 'string') {
						result[field.name] = obj['id'];
					}
				}
			}
		}

		return result;
	}

	/**
	 * Submit an upload collection form with file via multipart.
	 * Converts non-file form fields to string key-value pairs for the FormData.
	 */
	private submitUploadCollection(slug: string, data: Record<string, unknown>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const file = this.pendingFile();
			if (!file) {
				reject(new Error('No file selected'));
				return;
			}

			// Convert form data to string fields for FormData
			// Exclude auto-populated file metadata fields (they come from the server)
			const excludeFields = new Set([
				'filename',
				'mimeType',
				'filesize',
				'path',
				'url',
				'id',
				'createdAt',
				'updatedAt',
			]);
			const fields: Record<string, string> = {};
			for (const [key, value] of Object.entries(data)) {
				if (excludeFields.has(key)) continue;
				if (value === null || value === undefined || value === '') continue;
				if (typeof value === 'object') {
					// Skip empty objects/arrays; serialize non-empty ones as JSON
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					const isEmptyObject =
						!Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0;
					if ((Array.isArray(value) && value.length === 0) || isEmptyObject) continue;
					fields[key] = JSON.stringify(value);
				} else {
					fields[key] = String(value);
				}
			}

			this.isUploadingFile.set(true);
			this.uploadFileProgress.set(0);

			this.uploadService.uploadToCollection(slug, file, fields).subscribe({
				next: (progress: UploadProgress) => {
					this.uploadFileProgress.set(progress.progress);

					if (progress.status === 'complete' && progress.result) {
						this.isUploadingFile.set(false);
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
						resolve(progress.result as unknown as T);
					} else if (progress.status === 'error') {
						this.isUploadingFile.set(false);
						reject(new Error(progress.error ?? 'Upload failed'));
					}
				},
				error: (err: Error) => {
					this.isUploadingFile.set(false);
					reject(err);
				},
			});
		});
	}

	/**
	 * Handle cancel.
	 */
	onCancel(): void {
		this.cancelled.emit();
		if (!this.suppressNavigation()) {
			const listPath = `${this.basePath()}/${this.collection().slug}`;
			this.router.navigate([listPath]);
		}
	}

	/**
	 * Switch from view to edit mode.
	 */
	switchToEdit(): void {
		this.modeChange.emit('edit');
	}

	/**
	 * Handle version restore — reload the entity data.
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
			const data = this.formModel();

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

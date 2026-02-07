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
import { form, submit } from '@angular/forms/signals';
import type { CollectionConfig, Field } from '@momentum-cms/core';
import { humanizeFieldName } from '@momentum-cms/core';
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
import { type EntityFormMode, createInitialFormData } from './entity-form.types';
import { applyCollectionSchema } from './form-schema-builder';
import { FieldRenderer } from './field-renderers/field-renderer.component';
import { VersionHistoryWidget } from '../version-history/version-history.component';

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
		return col.labels?.plural || humanizeFieldName(col.slug);
	});

	/** Computed collection label singular */
	readonly collectionLabelSingular = computed(() => {
		const col = this.collection();
		return col.labels?.singular || humanizeFieldName(col.slug);
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
									tree as unknown as Record<string, unknown>,
									() => formModelRef(),
								);
							}),
						),
					);
					this.entityForm.set(f);
				}

				if (currentMode === 'create' || !id) {
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
	 * Handle form submission using Angular Signal Forms submit().
	 * submit() marks all fields as touched, then only calls the callback if valid.
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
				const data = this.formModel();
				let result: T;

				if (this.mode() === 'create') {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result = await this.api.collection<T>(slug).create(data as Partial<T>);
					this.feedback.entityCreated(this.collectionLabelSingular());
				} else {
					const id = this.entityId();
					if (!id) throw new Error('Entity ID required for update');
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					result = await this.api.collection<T>(slug).update(id, data as Partial<T>);
					this.feedback.entityUpdated(this.collectionLabelSingular());
				}

				this.originalData.set(result);
				this.formModel.set({ ...result });
				ef().reset();
				this.saved.emit(result);

				const listPath = `${this.basePath()}/${slug}`;
				this.router.navigate([listPath]);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Save failed';
				this.formError.set(errorMessage);
				this.feedback.operationFailed(
					'Save failed',
					err instanceof Error ? err : undefined,
				);
				this.saveError.emit(err instanceof Error ? err : new Error(errorMessage));
			} finally {
				this.isSubmitting.set(false);
			}
		});

		// submit() didn't call the callback — form is invalid
		if (!submitted) {
			this.formError.set('Please fix the errors above before submitting.');
		}
	}

	/**
	 * Handle cancel.
	 */
	onCancel(): void {
		this.cancelled.emit();
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
			this.feedback.operationFailed(
				'Draft save failed',
				err instanceof Error ? err : undefined,
			);
		} finally {
			this.isSavingDraft.set(false);
		}
	}
}

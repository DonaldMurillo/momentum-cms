import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	effect,
} from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { CollectionConfig, Field } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { MomentumApiService } from '../../services/api.service';

/**
 * Collection Edit Page Component
 *
 * Form for creating or editing a document in a collection.
 */
@Component({
	selector: 'mcms-collection-edit',
	standalone: true,
	imports: [RouterLink, FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="mcms-collection-edit">
			<header class="mcms-page-header">
				<div class="mcms-header-left">
					<a [routerLink]="['..']" class="mcms-back-link">&larr; Back to list</a>
					<h1>
						{{ isEditing() ? 'Edit' : 'Create' }} {{ collection()?.labels?.singular || 'Document' }}
					</h1>
				</div>
			</header>

			@if (error()) {
				<div class="mcms-error">{{ error() }}</div>
			}

			@if (loading()) {
				<div class="mcms-loading">Loading document...</div>
			} @else {
				<form class="mcms-form" (ngSubmit)="onSubmit()">
					<div class="mcms-form-fields">
						@for (field of collection()?.fields || []; track field.name) {
							<div class="mcms-field">
								<label [for]="field.name" class="mcms-label">
									{{ field.label || field.name }}
									@if (field.required) {
										<span class="mcms-required">*</span>
									}
								</label>

								@switch (field.type) {
									@case ('text') {
										<input
											type="text"
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-input"
											[required]="field.required || false"
										/>
									}
									@case ('textarea') {
										<textarea
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-textarea"
											[required]="field.required || false"
											rows="4"
										></textarea>
									}
									@case ('number') {
										<input
											type="number"
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-input"
											[required]="field.required || false"
										/>
									}
									@case ('email') {
										<input
											type="email"
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-input"
											[required]="field.required || false"
										/>
									}
									@case ('checkbox') {
										<input
											type="checkbox"
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-checkbox"
										/>
									}
									@case ('select') {
										<select
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-select"
											[required]="field.required || false"
										>
											<option value="">Select...</option>
											@for (option of getSelectOptions(field); track option.value) {
												<option [value]="option.value">{{ option.label }}</option>
											}
										</select>
									}
									@default {
										<input
											type="text"
											[id]="field.name"
											[name]="field.name"
											[(ngModel)]="formData()[field.name]"
											class="mcms-input"
										/>
									}
								}

								@if (field.description) {
									<p class="mcms-field-description">{{ field.description }}</p>
								}
							</div>
						}
					</div>

					<div class="mcms-form-actions">
						<button type="submit" class="mcms-btn mcms-btn-primary" [disabled]="saving()">
							{{ saving() ? 'Saving...' : isEditing() ? 'Update' : 'Create' }}
						</button>
						<a [routerLink]="['..']" class="mcms-btn mcms-btn-secondary">Cancel</a>
					</div>
				</form>
			}
		</div>
	`,
	styles: [
		`
			.mcms-collection-edit {
				max-width: 800px;
			}

			.mcms-back-link {
				display: inline-block;
				color: #6b7280;
				text-decoration: none;
				font-size: 0.875rem;
				margin-bottom: 0.5rem;
			}

			.mcms-back-link:hover {
				color: #3b82f6;
			}

			.mcms-page-header {
				margin-bottom: 2rem;
			}

			.mcms-page-header h1 {
				font-size: 2rem;
				font-weight: 700;
				color: #111827;
				margin: 0;
			}

			.mcms-form {
				background: white;
				border-radius: 0.5rem;
				border: 1px solid #e5e7eb;
				overflow: hidden;
			}

			.mcms-form-fields {
				padding: 2rem;
				display: flex;
				flex-direction: column;
				gap: 1.5rem;
			}

			.mcms-field {
				display: flex;
				flex-direction: column;
			}

			.mcms-label {
				font-weight: 500;
				color: #374151;
				margin-bottom: 0.5rem;
			}

			.mcms-required {
				color: #ef4444;
				margin-left: 0.25rem;
			}

			.mcms-input,
			.mcms-textarea,
			.mcms-select {
				padding: 0.75rem;
				border: 1px solid #d1d5db;
				border-radius: 0.375rem;
				font-size: 1rem;
				transition: border-color 0.15s;
			}

			.mcms-input:focus,
			.mcms-textarea:focus,
			.mcms-select:focus {
				outline: none;
				border-color: #3b82f6;
				box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
			}

			.mcms-checkbox {
				width: 1.25rem;
				height: 1.25rem;
			}

			.mcms-field-description {
				color: #6b7280;
				font-size: 0.875rem;
				margin: 0.5rem 0 0 0;
			}

			.mcms-form-actions {
				display: flex;
				gap: 1rem;
				padding: 1.5rem 2rem;
				background-color: #f9fafb;
				border-top: 1px solid #e5e7eb;
			}

			.mcms-btn {
				display: inline-flex;
				align-items: center;
				padding: 0.75rem 1.5rem;
				border-radius: 0.375rem;
				font-weight: 500;
				text-decoration: none;
				cursor: pointer;
				border: none;
				font-size: 1rem;
				transition: all 0.15s;
			}

			.mcms-btn-primary {
				background-color: #3b82f6;
				color: white;
			}

			.mcms-btn-primary:hover:not(:disabled) {
				background-color: #2563eb;
			}

			.mcms-btn-primary:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}

			.mcms-btn-secondary {
				background-color: #e5e7eb;
				color: #374151;
			}

			.mcms-btn-secondary:hover {
				background-color: #d1d5db;
			}

			.mcms-error {
				background-color: #fef2f2;
				border: 1px solid #fecaca;
				color: #dc2626;
				padding: 1rem;
				border-radius: 0.375rem;
				margin-bottom: 1rem;
			}

			.mcms-loading {
				padding: 2rem;
				text-align: center;
				color: #6b7280;
			}
		`,
	],
})
export class CollectionEditPage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly api = inject(MomentumApiService);

	readonly saving = signal(false);
	readonly loading = signal(false);
	readonly formData = signal<Record<string, unknown>>({});
	readonly error = signal<string | null>(null);

	readonly isEditing = computed((): boolean => {
		const id = this.route.snapshot.paramMap.get('id');
		return id !== null && id !== 'create';
	});

	readonly documentId = computed((): string | null => {
		return this.route.snapshot.paramMap.get('id');
	});

	readonly collection = computed((): CollectionConfig | undefined => {
		const slug = this.route.snapshot.paramMap.get('slug');
		const collections = getCollectionsFromRouteData(this.route.parent?.snapshot.data);
		return collections.find((c) => c.slug === slug);
	});

	constructor() {
		// Load existing document data when editing
		effect(() => {
			const collection = this.collection();
			const docId = this.documentId();
			if (collection && docId && docId !== 'create') {
				this.loadDocument(collection.slug, docId);
			}
		});
	}

	private loadDocument(collectionSlug: string, id: string): void {
		this.loading.set(true);
		this.api.findById(collectionSlug, id).subscribe({
			next: (doc) => {
				if (doc) {
					this.formData.set(doc);
				}
				this.loading.set(false);
			},
			error: () => {
				this.error.set('Failed to load document');
				this.loading.set(false);
			},
		});
	}

	getSelectOptions(field: Field): Array<{ label: string; value: string | number }> {
		if (field.type === 'select' && 'options' in field) {
			return field.options || [];
		}
		return [];
	}

	onSubmit(): void {
		const collection = this.collection();
		if (!collection) return;

		this.saving.set(true);
		this.error.set(null);

		const data = this.formData();
		const docId = this.documentId();

		const request$ =
			docId && docId !== 'create'
				? this.api.update(collection.slug, docId, data)
				: this.api.create(collection.slug, data);

		request$.subscribe({
			next: () => {
				this.saving.set(false);
				void this.router.navigate(['..'], { relativeTo: this.route });
			},
			error: (err: Error) => {
				this.saving.set(false);
				this.error.set(err.message || 'Failed to save document');
			},
		});
	}
}

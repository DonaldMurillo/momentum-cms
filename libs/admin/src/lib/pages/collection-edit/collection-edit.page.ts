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
	imports: [RouterLink, FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-3xl' },
	template: `
		<header class="mb-8">
			<a
				[routerLink]="['..']"
				class="inline-block text-muted-foreground text-sm no-underline mb-2 hover:text-primary transition-colors"
			>
				&larr; Back to list
			</a>
			<h1 class="text-3xl font-bold text-foreground m-0">
				{{ isEditing() ? 'Edit' : 'Create' }} {{ collection()?.labels?.singular || 'Document' }}
			</h1>
		</header>

		@if (error()) {
			<div
				class="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-md mb-4"
			>
				{{ error() }}
			</div>
		}

		@if (loading()) {
			<div class="p-8 text-center text-muted-foreground">Loading document...</div>
		} @else {
			<form class="bg-card rounded-lg border border-border overflow-hidden" (ngSubmit)="onSubmit()">
				<div class="p-8 flex flex-col gap-6">
					@for (field of collection()?.fields || []; track field.name) {
						<div class="flex flex-col">
							<label [for]="field.name" class="font-medium text-foreground mb-2">
								{{ field.label || field.name }}
								@if (field.required) {
									<span class="text-destructive ml-1">*</span>
								}
							</label>

							@switch (field.type) {
								@case ('text') {
									<input
										type="text"
										[id]="field.name"
										[name]="field.name"
										[(ngModel)]="formData()[field.name]"
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground"
										[required]="field.required || false"
									/>
								}
								@case ('textarea') {
									<textarea
										[id]="field.name"
										[name]="field.name"
										[(ngModel)]="formData()[field.name]"
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground resize-y"
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
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground"
										[required]="field.required || false"
									/>
								}
								@case ('email') {
									<input
										type="email"
										[id]="field.name"
										[name]="field.name"
										[(ngModel)]="formData()[field.name]"
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground"
										[required]="field.required || false"
									/>
								}
								@case ('checkbox') {
									<input
										type="checkbox"
										[id]="field.name"
										[name]="field.name"
										[(ngModel)]="formData()[field.name]"
										class="w-5 h-5 rounded border-input accent-primary"
									/>
								}
								@case ('select') {
									<select
										[id]="field.name"
										[name]="field.name"
										[(ngModel)]="formData()[field.name]"
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground"
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
										class="px-3 py-3 border border-input rounded-md text-base transition-colors outline-none focus:border-ring focus:ring-4 focus:ring-ring/10 bg-background text-foreground"
									/>
								}
							}

							@if (field.description) {
								<p class="text-muted-foreground text-sm mt-2 mb-0">{{ field.description }}</p>
							}
						</div>
					}
				</div>

				<div class="flex gap-4 px-8 py-6 bg-muted border-t border-border">
					<button
						type="submit"
						class="inline-flex items-center px-6 py-3 rounded-md font-medium text-base transition-all bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
						[disabled]="saving()"
					>
						{{ saving() ? 'Saving...' : isEditing() ? 'Update' : 'Create' }}
					</button>
					<a
						[routerLink]="['..']"
						class="inline-flex items-center px-6 py-3 rounded-md font-medium text-base transition-all bg-secondary text-secondary-foreground hover:bg-secondary/80 no-underline"
					>
						Cancel
					</a>
				</div>
			</form>
		}
	`,
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

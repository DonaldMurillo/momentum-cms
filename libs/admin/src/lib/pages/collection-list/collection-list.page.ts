import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { MomentumApiService } from '../../services/api.service';

/**
 * Collection List Page Component
 *
 * Displays a list of documents in a collection.
 */
@Component({
	selector: 'mcms-collection-list',
	standalone: true,
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="mcms-collection-list">
			<header class="mcms-page-header">
				<div class="mcms-header-left">
					<h1>{{ collection()?.labels?.plural || collection()?.slug || 'Collection' }}</h1>
					<p class="mcms-subtitle">
						Manage your {{ collection()?.labels?.plural?.toLowerCase() || 'documents' }}
					</p>
				</div>
				<div class="mcms-header-actions">
					<a [routerLink]="['create']" class="mcms-btn mcms-btn-primary"> + Create New </a>
				</div>
			</header>

			<div class="mcms-list-container">
				@if (loading()) {
					<div class="mcms-loading">Loading...</div>
				} @else if (documents().length === 0) {
					<div class="mcms-empty-state">
						<p>No {{ collection()?.labels?.plural?.toLowerCase() || 'documents' }} yet.</p>
						<a [routerLink]="['create']" class="mcms-btn mcms-btn-secondary">
							Create your first one
						</a>
					</div>
				} @else {
					<table class="mcms-table">
						<thead>
							<tr>
								<th>ID</th>
								@for (field of displayFields(); track field.name) {
									<th>{{ field.label || field.name }}</th>
								}
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							@for (doc of documents(); track doc['id']) {
								<tr>
									<td>{{ doc['id'] }}</td>
									@for (field of displayFields(); track field.name) {
										<td>{{ doc[field.name] || '-' }}</td>
									}
									<td>
										<a [routerLink]="[doc['id']]" class="mcms-link">Edit</a>
									</td>
								</tr>
							}
						</tbody>
					</table>
				}
			</div>
		</div>
	`,
	styles: [
		`
			.mcms-collection-list {
				max-width: 1200px;
			}

			.mcms-page-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 2rem;
			}

			.mcms-page-header h1 {
				font-size: 2rem;
				font-weight: 700;
				color: #111827;
				margin: 0;
			}

			.mcms-subtitle {
				color: #6b7280;
				margin: 0.5rem 0 0 0;
			}

			.mcms-btn {
				display: inline-flex;
				align-items: center;
				padding: 0.625rem 1.25rem;
				border-radius: 0.375rem;
				font-weight: 500;
				text-decoration: none;
				cursor: pointer;
				transition: all 0.15s;
			}

			.mcms-btn-primary {
				background-color: #3b82f6;
				color: white;
			}

			.mcms-btn-primary:hover {
				background-color: #2563eb;
			}

			.mcms-btn-secondary {
				background-color: #e5e7eb;
				color: #374151;
			}

			.mcms-btn-secondary:hover {
				background-color: #d1d5db;
			}

			.mcms-list-container {
				background: white;
				border-radius: 0.5rem;
				border: 1px solid #e5e7eb;
				overflow: hidden;
			}

			.mcms-table {
				width: 100%;
				border-collapse: collapse;
			}

			.mcms-table th,
			.mcms-table td {
				padding: 1rem;
				text-align: left;
				border-bottom: 1px solid #e5e7eb;
			}

			.mcms-table th {
				background-color: #f9fafb;
				font-weight: 600;
				color: #374151;
				font-size: 0.875rem;
			}

			.mcms-table tbody tr:hover {
				background-color: #f9fafb;
			}

			.mcms-link {
				color: #3b82f6;
				text-decoration: none;
			}

			.mcms-link:hover {
				text-decoration: underline;
			}

			.mcms-loading,
			.mcms-empty-state {
				padding: 3rem;
				text-align: center;
				color: #6b7280;
			}

			.mcms-empty-state .mcms-btn {
				margin-top: 1rem;
			}
		`,
	],
})
export class CollectionListPage {
	private readonly route = inject(ActivatedRoute);
	private readonly api = inject(MomentumApiService);

	readonly loading = signal(true);
	readonly documents = signal<Record<string, unknown>[]>([]);

	// Reactive slug signal that updates when route params change
	// Use snapshot for initial value to support SSR, then reactive updates for SPA navigation
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

	readonly displayFields = computed(() => {
		const collection = this.collection();
		if (!collection) return [];

		// Show first 3 non-system fields in the table
		return collection.fields.slice(0, 3).map((field) => ({
			name: field.name,
			label: field.label || field.name,
		}));
	});

	constructor() {
		// Fetch documents when collection changes
		effect(() => {
			const collection = this.collection();
			if (collection) {
				this.loadDocuments(collection.slug);
			}
		});
	}

	private loadDocuments(collectionSlug: string): void {
		this.loading.set(true);
		this.api.findAll(collectionSlug).subscribe({
			next: (docs) => {
				this.documents.set(docs);
				this.loading.set(false);
			},
			error: () => {
				this.documents.set([]);
				this.loading.set(false);
			},
		});
	}
}

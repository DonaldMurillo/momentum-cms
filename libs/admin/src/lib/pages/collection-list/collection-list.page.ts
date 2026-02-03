import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	effect,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-5xl' },
	template: `
		<header class="flex justify-between items-start mb-8">
			<div>
				<h1 class="text-3xl font-bold text-foreground">
					{{ collection()?.labels?.plural || collection()?.slug || 'Collection' }}
				</h1>
				<p class="text-muted-foreground mt-2">
					Manage your {{ collection()?.labels?.plural?.toLowerCase() || 'documents' }}
				</p>
			</div>
			<a
				[routerLink]="['create']"
				class="inline-flex items-center px-5 py-2.5 rounded-md font-medium no-underline cursor-pointer transition-all bg-primary text-primary-foreground hover:bg-primary/90"
			>
				+ Create New
			</a>
		</header>

		<div class="bg-card rounded-lg border border-border overflow-hidden">
			@if (loading()) {
				<div class="p-12 text-center text-muted-foreground">Loading...</div>
			} @else if (documents().length === 0) {
				<div class="p-12 text-center text-muted-foreground">
					<p>No {{ collection()?.labels?.plural?.toLowerCase() || 'documents' }} yet.</p>
					<a
						[routerLink]="['create']"
						class="inline-flex items-center mt-4 px-5 py-2.5 rounded-md font-medium no-underline cursor-pointer transition-all bg-secondary text-secondary-foreground hover:bg-secondary/80"
					>
						Create your first one
					</a>
				</div>
			} @else {
				<table class="w-full">
					<thead>
						<tr>
							<th
								class="px-4 py-4 text-left border-b border-border bg-muted font-semibold text-muted-foreground text-sm"
							>
								ID
							</th>
							@for (field of displayFields(); track field.name) {
								<th
									class="px-4 py-4 text-left border-b border-border bg-muted font-semibold text-muted-foreground text-sm"
								>
									{{ field.label || field.name }}
								</th>
							}
							<th
								class="px-4 py-4 text-left border-b border-border bg-muted font-semibold text-muted-foreground text-sm"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="text-foreground">
						@for (doc of documents(); track doc['id']) {
							<tr class="hover:bg-muted/50 transition-colors">
								<td class="px-4 py-4 border-b border-border text-sm">{{ doc['id'] }}</td>
								@for (field of displayFields(); track field.name) {
									<td class="px-4 py-4 border-b border-border">{{ doc[field.name] || '-' }}</td>
								}
								<td class="px-4 py-4 border-b border-border">
									<a
										[routerLink]="[doc['id']]"
										class="text-primary font-medium no-underline hover:underline"
									>
										Edit
									</a>
								</td>
							</tr>
						}
					</tbody>
				</table>
			}
		</div>
	`,
})
export class CollectionListPage {
	private readonly route = inject(ActivatedRoute);
	private readonly api = inject(MomentumApiService);
	private readonly platformId = inject(PLATFORM_ID);

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
		// Only on client side - SSR doesn't have access to auth cookies
		effect(() => {
			const collection = this.collection();
			if (collection && isPlatformBrowser(this.platformId)) {
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

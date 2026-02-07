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
import { RouterLink } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { humanizeFieldName } from '@momentum-cms/core';
import {
	Card,
	CardHeader,
	CardContent,
	CardFooter,
	Badge,
	Button,
	Skeleton,
} from '@momentum-cms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { CollectionAccessService } from '../../services/collection-access.service';

/**
 * Collection Card Widget
 *
 * Displays a collection card with document count fetched from API.
 * Useful for dashboard overviews and collection navigation.
 *
 * @example
 * ```html
 * <mcms-collection-card
 *   [collection]="postsCollection"
 *   basePath="/admin/collections"
 *   (viewAll)="navigateToCollection($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-collection-card',
	imports: [RouterLink, Card, CardHeader, CardContent, CardFooter, Badge, Button, Skeleton],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-card>
			<mcms-card-header>
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-lg">{{ collectionLabel() }}</h3>
					@if (loading()) {
						<mcms-skeleton class="w-12 h-6" />
					} @else if (error()) {
						<mcms-badge variant="destructive">Error</mcms-badge>
					} @else {
						<mcms-badge variant="secondary">{{ count() }}</mcms-badge>
					}
				</div>
			</mcms-card-header>

			<mcms-card-content>
				@if (collection().admin?.description) {
					<p class="text-sm text-muted-foreground">
						{{ collection().admin!.description }}
					</p>
				} @else {
					<p class="text-sm text-muted-foreground">Manage {{ collectionLabelLower() }}</p>
				}
			</mcms-card-content>

			<mcms-card-footer class="flex gap-3 pt-2">
				@if (canCreate()) {
					<a mcms-button variant="primary" size="sm" [routerLink]="createPath()"> Create </a>
				}
				<a mcms-button variant="outline" size="sm" [routerLink]="viewPath()"> View all </a>
			</mcms-card-footer>
		</mcms-card>
	`,
})
export class CollectionCardWidget {
	private readonly api = injectMomentumAPI();
	private readonly collectionAccess = inject(CollectionAccessService);

	/** The collection to display */
	readonly collection = input.required<CollectionConfig>();

	/** Base path for collection routes */
	readonly basePath = input('/admin/collections');

	/** Whether to show document count */
	readonly showDocumentCount = input(true);

	/** Emitted when view all is clicked */
	readonly viewAll = output<CollectionConfig>();

	/** Document count from API */
	readonly count = signal(0);

	/** Whether count is loading */
	readonly loading = signal(true);

	/** Error message if count fetch failed */
	readonly error = signal<string | null>(null);

	/** Display label for the collection */
	readonly collectionLabel = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.plural || col.slug);
	});

	/** Lowercase label for descriptions */
	readonly collectionLabelLower = computed(() => {
		return this.collectionLabel().toLowerCase();
	});

	/** Path to view all documents */
	readonly viewPath = computed(() => {
		return `${this.basePath()}/${this.collection().slug}`;
	});

	/** Path to create new document */
	readonly createPath = computed(() => {
		return `${this.basePath()}/${this.collection().slug}/new`;
	});

	/** Whether user can create documents */
	readonly canCreate = computed(() => {
		return this.collectionAccess.canCreate(this.collection().slug);
	});

	constructor() {
		// Fetch count when collection changes
		effect(() => {
			const col = this.collection();
			const showCount = this.showDocumentCount();

			if (showCount && col) {
				this.fetchCount(col.slug);
			}
		});
	}

	/**
	 * Fetch document count for the collection.
	 */
	private async fetchCount(slug: string): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const result = await this.api.collection(slug).find({ limit: 0 });
			this.count.set(result.totalDocs);
		} catch {
			this.error.set('Failed to load count');
			this.count.set(0);
		} finally {
			this.loading.set(false);
		}
	}
}

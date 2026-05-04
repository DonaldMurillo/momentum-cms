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
import { DecimalPipe } from '@angular/common';
import type { CollectionConfig } from '@momentumcms/core';
import { humanizeFieldName } from '@momentumcms/core';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { CollectionAccessService } from '../../services/collection-access.service';

/**
 * Collection Card Widget — list-row presentation of a collection on the
 * dashboard. Despite the historical "card" name, this renders as an editorial
 * row: name + count + actions on a hairline-divided line. The grid-of-tiles
 * pattern was visually noisy and templated; rows scan better and respect the
 * fact that collections are often dozens, not three.
 *
 * @example
 * ```html
 * <mcms-collection-card
 *   [collection]="postsCollection"
 *   basePath="/admin/collections"
 * />
 * ```
 */
@Component({
	selector: 'mcms-collection-card',
	imports: [RouterLink, DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'group/row block border-b border-border transition-colors hover:bg-muted/40',
	},
	template: `
		<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1 py-3.5 px-3 -mx-3">
			<a
				[routerLink]="viewPath()"
				class="flex flex-col min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
			>
				<span class="text-base font-medium text-foreground truncate">
					{{ collectionLabel() }}
				</span>
				<span class="text-sm text-muted-foreground truncate">
					{{ description() }}
				</span>
			</a>

			<span
				class="mcms-mono text-sm tabular-nums text-foreground/80"
				[attr.aria-label]="countAriaLabel()"
			>
				@if (loading()) {
					—
				} @else if (error()) {
					<span class="text-destructive" title="Failed to load count">!</span>
				} @else {
					{{ count() | number }}
				}
			</span>

			<div class="flex items-center gap-1 text-xs">
				@if (canCreate()) {
					<a
						[routerLink]="createPath()"
						class="rounded px-2 py-1 font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
					>
						New
					</a>
				}
				<a
					[routerLink]="viewPath()"
					class="rounded px-2 py-1 font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors group-hover/row:text-foreground"
				>
					Open →
				</a>
			</div>
		</div>
	`,
})
export class CollectionCardWidget {
	private readonly api = injectMomentumAPI();
	private readonly collectionAccess = inject(CollectionAccessService);

	readonly collection = input.required<CollectionConfig>();
	readonly basePath = input('/admin/collections');
	readonly showDocumentCount = input(true);
	readonly viewAll = output<CollectionConfig>();

	readonly count = signal(0);
	readonly loading = signal(true);
	readonly error = signal<string | null>(null);

	readonly collectionLabel = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.plural || col.slug);
	});

	readonly description = computed(() => {
		const col = this.collection();
		return col.admin?.description ?? `Manage ${this.collectionLabel().toLowerCase()}`;
	});

	readonly countAriaLabel = computed(() => `${this.count()} entries in ${this.collectionLabel()}`);

	readonly viewPath = computed(() => `${this.basePath()}/${this.collection().slug}`);
	readonly createPath = computed(() => `${this.basePath()}/${this.collection().slug}/new`);
	readonly canCreate = computed(() => this.collectionAccess.canCreate(this.collection().slug));

	constructor() {
		effect(() => {
			const col = this.collection();
			const showCount = this.showDocumentCount();
			if (showCount && col) {
				this.fetchCount(col.slug);
			}
		});
	}

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

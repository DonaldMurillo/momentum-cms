import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { CollectionConfig } from '@momentum-cms/core';
import { humanizeFieldName } from '@momentum-cms/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { Button } from '@momentum-cms/ui';
import { EntityFormWidget } from '../../widgets/entity-form/entity-form.component';
import { EntityViewWidget } from '../../widgets/entity-view/entity-view.component';
import { EntitySheetService } from '../../services/entity-sheet.service';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import type { EntityFormMode } from '../../widgets/entity-form/entity-form.types';
import type { Entity } from '../../widgets/widget.types';

/**
 * Entity Sheet Content Component
 *
 * Rendered directly inside the AdminShell when the sheet is open.
 * Reads query parameters to determine which collection/entity to show
 * and renders the appropriate form or view widget.
 */
@Component({
	selector: 'mcms-entity-sheet-content',
	imports: [EntityFormWidget, EntityViewWidget, NgIcon, Button],
	providers: [provideIcons({ heroXMark })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'flex flex-col h-full' },
	template: `
		<!-- Header -->
		<header
			class="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 shrink-0"
		>
			<h2 class="text-lg font-semibold tracking-tight truncate">{{ title() }}</h2>
			<button
				mcms-button
				variant="ghost"
				class="shrink-0"
				(click)="onClose()"
				aria-label="Close sheet"
			>
				<ng-icon name="heroXMark" size="20" aria-hidden="true" />
			</button>
		</header>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			@if (mode() === 'view' && collection() && entityId()) {
				<mcms-entity-view
					[collection]="collection()!"
					[entityId]="entityId()!"
					[suppressNavigation]="true"
					[showBreadcrumbs]="false"
					[showVersionHistory]="false"
					(edit)="onSwitchToEdit()"
				/>
			} @else if (collection()) {
				<mcms-entity-form
					[collection]="collection()!"
					[entityId]="entityId()"
					[mode]="formMode()"
					[suppressNavigation]="true"
					[showBreadcrumbs]="false"
					(saved)="onSaved($event)"
					(cancelled)="onClose()"
				/>
			}
		</div>
	`,
})
export class EntitySheetContentComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly sheetService = inject(EntitySheetService);

	/** Query params as a signal */
	private readonly queryParams = toSignal(this.route.queryParamMap);

	/** The collection slug from query params */
	readonly collectionSlug = computed(() => this.queryParams()?.get('sheetCollection') ?? null);

	/** The entity ID from query params (null for create mode) */
	readonly entityId = computed(() => this.queryParams()?.get('sheetEntityId') ?? undefined);

	/** The mode from query params */
	private readonly rawMode = computed(() => this.queryParams()?.get('sheetMode') ?? null);

	/** Local mode override (for switching from view to edit within the sheet) */
	private readonly localModeOverride = signal<EntityFormMode | null>(null);

	/** Effective mode */
	readonly mode = computed((): EntityFormMode => {
		const override = this.localModeOverride();
		if (override) return override;

		const raw = this.rawMode();
		if (raw === 'view' || raw === 'edit' || raw === 'create') return raw;
		return this.entityId() ? 'view' : 'create';
	});

	/** Form mode (maps 'view' to 'edit' for the form widget since view uses EntityViewWidget) */
	readonly formMode = computed((): EntityFormMode => {
		const m = this.mode();
		return m === 'view' ? 'edit' : m;
	});

	/** Collection config resolved from route data */
	readonly collection = computed((): CollectionConfig | null => {
		const slug = this.collectionSlug();
		if (!slug) return null;

		// Walk up the route tree to find the admin shell route with collections data
		let current: ActivatedRoute | null = this.route;
		while (current) {
			const collections = getCollectionsFromRouteData(current.snapshot.data);
			if (collections.length > 0) {
				return collections.find((c) => c.slug === slug) ?? null;
			}
			current = current.parent;
		}
		return null;
	});

	/** Human-readable title */
	readonly title = computed((): string => {
		const col = this.collection();
		const m = this.mode();
		const label = col ? humanizeFieldName(col.labels?.singular ?? col.slug) : 'Entity';

		switch (m) {
			case 'create':
				return `Create ${label}`;
			case 'edit':
				return `Edit ${label}`;
			default:
				return label;
		}
	});

	/** Handle entity saved */
	onSaved(entity: Entity): void {
		const slug = this.collectionSlug() ?? '';
		this.sheetService.close({
			action: this.mode() === 'create' ? 'created' : 'updated',
			entity,
			collection: slug,
		});
	}

	/** Handle close */
	onClose(): void {
		const slug = this.collectionSlug() ?? '';
		this.sheetService.close({ action: 'cancelled', collection: slug });
	}

	/** Switch from view to edit mode within the sheet */
	onSwitchToEdit(): void {
		this.localModeOverride.set('edit');
		// Also update the query param so URL stays in sync
		this.router.navigate([], {
			queryParams: { sheetMode: 'edit' },
			queryParamsHandling: 'merge',
		});
	}
}

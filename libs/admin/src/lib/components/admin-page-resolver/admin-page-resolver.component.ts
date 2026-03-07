import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	OnInit,
	signal,
	Type,
	viewChild,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { AdminComponentRegistry } from '../../services/admin-component-registry.service';
import type { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';

/**
 * Registry-aware page resolver that delegates to either a registered
 * custom component or the built-in fallback.
 *
 * Used as the `loadComponent` for every admin route. Route `data` provides:
 * - `adminPageKey` — the registry key (e.g., 'dashboard', 'collection-list')
 * - `adminPageFallback` — lazy loader for the built-in default
 *
 * For collection pages, reads `:slug` from route params to check per-collection overrides.
 *
 * Subscribes to route observables so the component re-resolves when Angular
 * reuses the instance for sibling routes (e.g., navigating between collections).
 *
 * Implements HasUnsavedChanges to delegate to the resolved component for
 * the unsaved changes guard.
 */
@Component({
	selector: 'mcms-admin-page-resolver',
	imports: [NgComponentOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (resolvedComponent()) {
			<ng-container *ngComponentOutlet="resolvedComponent()" />
		} @else {
			<div role="status" aria-label="Loading page" class="flex h-full items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
			</div>
		}
	`,
})
export class AdminPageResolver implements OnInit, HasUnsavedChanges {
	private readonly registry = inject(AdminComponentRegistry);
	private readonly route = inject(ActivatedRoute);
	private readonly destroyRef = inject(DestroyRef);
	private readonly outlet = viewChild(NgComponentOutlet);

	readonly resolvedComponent = signal<Type<unknown> | null>(null);

	/** Incremented on every load to detect stale promise resolutions. */
	private loadGeneration = 0;

	ngOnInit(): void {
		combineLatest([this.route.data, this.route.params])
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(([data, params]) => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route data is Record<string, unknown>
				const pageKey = data['adminPageKey'] as string;
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route data is Record<string, unknown>
				const fallback = data['adminPageFallback'] as () => Promise<Type<unknown>>;
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route params are Record<string, string>
				const slug = params['slug'] as string | undefined;

				const override = this.registry.resolve(pageKey, slug);
				const loader = override ?? fallback;
				if (loader) {
					const generation = ++this.loadGeneration;
					loader()
						.then((component) => {
							if (generation !== this.loadGeneration) return;
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- loader resolves to unknown from registry, safe cast to Type
							this.resolvedComponent.set(component as Type<unknown>);
						})
						.catch((err: unknown) => {
							if (generation !== this.loadGeneration) return;
							console.error('[AdminPageResolver] Failed to load component:', err);
						});
				}
			});
	}

	hasUnsavedChanges(): boolean {
		const instance = this.outlet()?.componentInstance;
		if (instance == null) return false;
		// Check if the resolved component implements HasUnsavedChanges
		if ('hasUnsavedChanges' in instance && typeof instance.hasUnsavedChanges === 'function') {
			return Boolean(instance.hasUnsavedChanges());
		}
		return false;
	}
}

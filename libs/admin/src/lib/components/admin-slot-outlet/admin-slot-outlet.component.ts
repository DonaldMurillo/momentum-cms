import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
	Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AdminSlotRegistry } from '../../services/admin-slot-registry.service';
import type { AdminSlotContext } from '../../services/admin-component-registry.types';

/**
 * Renders all components registered for a named admin layout slot.
 *
 * Usage:
 * ```html
 * <mcms-admin-slot slot="dashboard:before" />
 * <mcms-admin-slot slot="collection-list:before" [collectionSlug]="slug" />
 * ```
 */
@Component({
	selector: 'mcms-admin-slot',
	imports: [NgComponentOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@for (component of resolvedComponents(); track $index) {
			<ng-container *ngComponentOutlet="component; inputs: slotInputs()" />
		}
	`,
})
export class AdminSlotOutlet {
	private readonly registry = inject(AdminSlotRegistry);

	/** The slot key to render (e.g., 'dashboard:before'). */
	readonly slot = input.required<string>();

	/** Optional collection slug for per-collection slot resolution. */
	readonly collectionSlug = input<string>();

	/** Optional context passed as inputs to slot components. */
	readonly context = input<AdminSlotContext>({});

	/** Resolved component types after lazy loading. */
	readonly resolvedComponents = signal<Type<unknown>[]>([]);

	/** Inputs to pass to each slot component. */
	readonly slotInputs = computed(() => ({
		...this.context(),
	}));

	/** Incremented on every effect run to detect stale promise resolutions. */
	private loadGeneration = 0;

	constructor() {
		effect(() => {
			const slot = this.slot();
			const slug = this.collectionSlug();
			const loaders = this.registry.resolve(slot, slug);

			if (loaders.length === 0) {
				this.resolvedComponents.set([]);
				return;
			}

			const generation = ++this.loadGeneration;
			Promise.all(loaders.map((loader) => loader()))
				.then((components) => {
					if (generation !== this.loadGeneration) return;
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- loaders resolve to unknown from registry, safe cast to Type[]
					this.resolvedComponents.set(components as Type<unknown>[]);
				})
				.catch((err: unknown) => {
					if (generation !== this.loadGeneration) return;
					console.error('[AdminSlotOutlet] Failed to load slot components:', err);
					this.resolvedComponents.set([]);
				});
		});
	}
}

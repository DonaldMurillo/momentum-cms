/**
 * Block Outlet Component
 *
 * Programmatically renders a single block using ViewContainerRef.createComponent().
 * Looks up the component type from the BLOCK_COMPONENT_REGISTRY injection token.
 * Falls back to BLOCK_FALLBACK_COMPONENT for unregistered types, or renders nothing.
 *
 * Each instantiated component receives block data via `setInput('data', blockData)`.
 */

import {
	ChangeDetectionStrategy,
	Component,
	type ComponentRef,
	effect,
	inject,
	input,
	ViewContainerRef,
} from '@angular/core';
import { BLOCK_COMPONENT_REGISTRY, BLOCK_FALLBACK_COMPONENT } from './block-renderer.types';

@Component({
	selector: 'mcms-block-outlet',
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockOutletComponent {
	private readonly vcr = inject(ViewContainerRef);
	private readonly registry = inject(BLOCK_COMPONENT_REGISTRY);
	private readonly fallback = inject(BLOCK_FALLBACK_COMPONENT, { optional: true });

	/** The block type slug used to look up the component in the registry. */
	readonly blockType = input.required<string>();

	/** The block data object passed to the instantiated component via setInput. */
	readonly blockData = input.required<Record<string, unknown>>();

	private componentRef: ComponentRef<unknown> | null = null;

	constructor() {
		effect(() => {
			const type = this.blockType();
			const data = this.blockData();
			const componentType = this.registry.get(type) ?? this.fallback ?? null;

			this.vcr.clear();
			this.componentRef = null;

			if (componentType) {
				this.componentRef = this.vcr.createComponent(componentType);
				this.componentRef.setInput('data', data);
			}
		});
	}
}

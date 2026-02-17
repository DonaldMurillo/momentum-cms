import { Injectable, Type } from '@angular/core';

/**
 * Registry for field renderer components.
 *
 * Maps field type names (e.g., 'text', 'number', 'blocks') to lazy component loaders.
 * Eliminates static imports and enables custom field types via `provideFieldRenderer()`.
 *
 * Built-in renderers are registered via `provideMomentumFieldRenderers()` in app bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class FieldRendererRegistry {
	private readonly renderers = new Map<string, () => Promise<Type<unknown>>>();

	/** Register a lazy loader for a field type. Later registrations override earlier ones. */
	register(type: string, loader: () => Promise<Type<unknown>>): void {
		this.renderers.set(type, loader);
	}

	/** Get the lazy loader for a field type. Returns undefined if not registered. */
	get(type: string): (() => Promise<Type<unknown>>) | undefined {
		return this.renderers.get(type);
	}

	/** Check if a field type has a registered renderer. */
	has(type: string): boolean {
		return this.renderers.has(type);
	}
}

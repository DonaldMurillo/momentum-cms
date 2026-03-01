import { Injectable, Type } from '@angular/core';

/**
 * Registry for custom form field renderer components.
 *
 * Built-in field types (text, email, select, etc.) are registered by default
 * via `provideMomentumFormBuilder()`. Custom field types can be added via
 * `provideFormFieldRenderer()`.
 */
@Injectable({ providedIn: 'root' })
export class FormFieldRegistry {
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

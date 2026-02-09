import { InjectionToken, type Provider, type Type } from '@angular/core';

/**
 * @deprecated Use `BlockAdminModeService` via `provideBlockAdminMode()` instead.
 * When provided and true, block renderer shows admin edit overlays on hover.
 */
export const BLOCK_ADMIN_MODE = new InjectionToken<boolean>('BLOCK_ADMIN_MODE');

/** Registry mapping block type slugs to their renderer components. */
export const BLOCK_COMPONENT_REGISTRY = new InjectionToken<Map<string, Type<unknown>>>(
	'BLOCK_COMPONENT_REGISTRY',
);

/** Optional fallback component rendered for unregistered block types. */
export const BLOCK_FALLBACK_COMPONENT = new InjectionToken<Type<unknown>>(
	'BLOCK_FALLBACK_COMPONENT',
);

/**
 * Provide block components for the block renderer via DI.
 *
 * @example
 * ```typescript
 * providers: [
 *   ...provideBlockComponents({
 *     hero: HeroBlockComponent,
 *     textBlock: TextBlockComponent,
 *     feature: FeatureBlockComponent,
 *   }),
 * ]
 * ```
 */
export function provideBlockComponents(registry: Record<string, Type<unknown>>): Provider[] {
	return [{ provide: BLOCK_COMPONENT_REGISTRY, useValue: new Map(Object.entries(registry)) }];
}

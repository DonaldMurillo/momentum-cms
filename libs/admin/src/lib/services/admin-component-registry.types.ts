import type { Type } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';

/** Lazy loader that returns an Angular component class. */
export type ComponentLoader = () => Promise<Type<unknown>>;

/**
 * Keys for swappable admin pages.
 * Used in AdminComponentRegistry to replace built-in pages.
 *
 * Resolution chain for collection pages:
 *   per-collection key (e.g. "collections/articles/list")
 *   → global key (e.g. "collection-list")
 *   → built-in default
 */
export type AdminComponentKey =
	| 'dashboard'
	| 'login'
	| 'media'
	| 'collection-list'
	| 'collection-edit'
	| 'collection-view'
	| 'global-edit';

/**
 * Keys for named layout slots in admin pages.
 * Slots are additive — multiple components can be registered for the same slot.
 *
 * Per-collection variants use the pattern: `{base-slot}:{collection-slug}`
 * e.g. `collection-list:before:articles`
 */
export type AdminSlotKey =
	// Shell slots
	| 'shell:header'
	| 'shell:footer'
	| 'shell:nav-start'
	| 'shell:nav-end'
	// Dashboard slots
	| 'dashboard:before'
	| 'dashboard:after'
	// Collection list slots
	| 'collection-list:before'
	| 'collection-list:after'
	// Collection edit slots
	| 'collection-edit:before'
	| 'collection-edit:after'
	| 'collection-edit:sidebar'
	// Collection view slots
	| 'collection-view:before'
	| 'collection-view:after'
	// Login slots
	| 'login:before'
	| 'login:after'
	// Per-collection variant (string template)
	| `${'collection-list' | 'collection-edit' | 'collection-view'}:${'before' | 'after' | 'sidebar'}:${string}`;

/**
 * Context passed to slot components via input bindings.
 * Available as inputs on any component rendered in a slot.
 */
export interface AdminSlotContext {
	/** The collection config, if the slot is within a collection page. */
	collection?: CollectionConfig;
	/** The entity ID, if the slot is within an entity view/edit page. */
	entityId?: string;
}

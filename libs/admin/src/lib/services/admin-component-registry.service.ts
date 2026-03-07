import { Injectable } from '@angular/core';

type Loader = () => Promise<unknown>;

/**
 * Registry for swappable admin page components.
 *
 * Maps page keys (e.g., 'dashboard', 'collection-list') to lazy component loaders.
 * Per-collection overrides use the pattern: 'collections/{slug}/{type}'.
 *
 * Resolution chain: per-collection → global → undefined (use built-in default).
 */
@Injectable({ providedIn: 'root' })
export class AdminComponentRegistry {
	private readonly components = new Map<string, Loader>();

	/** Register a lazy loader for a page key. Later registrations override earlier ones. */
	register(key: string, loader: Loader): void {
		this.components.set(key, loader);
	}

	/** Get the lazy loader for a page key. Returns undefined if not registered. */
	get(key: string): Loader | undefined {
		return this.components.get(key);
	}

	/** Check if a page key has a registered component. */
	has(key: string): boolean {
		return this.components.has(key);
	}

	/**
	 * Resolve a component loader with per-collection fallback.
	 *
	 * For collection pages, tries `collections/{slug}/{type}` first,
	 * then falls back to the global key (e.g., 'collection-list').
	 */
	resolve(key: string, slug?: string): Loader | undefined {
		if (slug) {
			const type = key.replace('collection-', '');
			const perCollectionKey = `collections/${slug}/${type}`;
			const perCollection = this.components.get(perCollectionKey);
			if (perCollection) return perCollection;
		}
		return this.components.get(key);
	}
}

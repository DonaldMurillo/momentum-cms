/**
 * SEO Field Injector
 *
 * Browser-safe — no server-side imports.
 * Injects SEO fields as a named tab into targeted collections.
 * Must be idempotent — called during both config generation and server init.
 */

import type { CollectionConfig, TabsField } from '@momentumcms/core';
import { tabs } from '@momentumcms/core';
import { createSeoTabConfig } from './seo-fields';
import { hasSeoField } from './seo-utils';

export interface SeoFieldInjectorOptions {
	collections: string[] | '*';
	excludeCollections?: string[];
}

/**
 * Check if a collection should receive SEO fields.
 */
function shouldInject(collection: CollectionConfig, options: SeoFieldInjectorOptions): boolean {
	// Skip managed (external) collections
	if (collection.managed) return false;

	// Skip internal plugin collections
	if (collection.slug.startsWith('seo-')) return false;

	if (options.collections === '*') {
		return !(options.excludeCollections ?? []).includes(collection.slug);
	}
	return options.collections.includes(collection.slug);
}

/**
 * Find a top-level tabs field in a collection's fields.
 */
function findTopLevelTabs(collection: CollectionConfig): TabsField | undefined {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing field union by type discriminant
	return collection.fields.find((f) => f.type === 'tabs') as TabsField | undefined;
}

/**
 * Inject SEO fields as a named tab into targeted collections.
 *
 * - If the collection already has a top-level `tabs()` field, the SEO tab
 *   is appended to its tabs array.
 * - Otherwise, all existing fields are wrapped in an unnamed "Content" tab
 *   and the SEO tab is added alongside it.
 *
 * Data model is unchanged: a named tab `{ name: 'seo' }` stores data
 * at `doc.seo.*` — identical to the previous `group('seo', ...)`.
 *
 * @param collections - Mutable collections array
 * @param options - Which collections to target
 */
export function injectSeoFields(
	collections: CollectionConfig[],
	options: SeoFieldInjectorOptions,
): void {
	const seoTab = createSeoTabConfig();

	for (const collection of collections) {
		if (!shouldInject(collection, options)) continue;
		if (hasSeoField(collection)) continue;

		const existingTabs = findTopLevelTabs(collection);

		if (existingTabs) {
			// Append SEO tab to existing tabs field
			existingTabs.tabs.push(seoTab);
		} else {
			// Wrap all existing fields in an unnamed "Content" tab + add SEO tab
			const originalFields = [...collection.fields];
			const tabsField = tabs('seoTabs', {
				tabs: [{ label: 'Content', fields: originalFields }, seoTab],
			});
			collection.fields = [tabsField];
		}
	}
}

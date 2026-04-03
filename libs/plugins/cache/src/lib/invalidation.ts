/**
 * Cache Invalidation
 *
 * Injects afterChange and afterDelete hooks into collections to
 * automatically invalidate cached responses on writes.
 */

import type { CollectionConfig, HookFunction } from '@momentumcms/core';
import type { CacheAdapter } from './cache-adapter.types';
import type { PluginLogger } from '@momentumcms/core';

/**
 * Build a dependency graph: for each collection, find which other collections
 * have relationship fields pointing to it. When A is invalidated, we also
 * invalidate any collection B that references A (populated data may be stale).
 */
export function buildDependencyGraph(collections: CollectionConfig[]): Map<string, string[]> {
	const graph = new Map<string, string[]>();

	for (const collection of collections) {
		scanFieldsForRelationships(collection.slug, collection.fields, graph);
	}

	return graph;
}

function scanFieldsForRelationships(
	ownerSlug: string,
	fields: CollectionConfig['fields'],
	graph: Map<string, string[]>,
): void {
	for (const field of fields) {
		if (field.type === 'relationship' && 'relationTo' in field) {
			const targets = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo];
			for (const target of targets) {
				if (typeof target === 'string') {
					const dependents = graph.get(target) ?? [];
					if (!dependents.includes(ownerSlug)) {
						dependents.push(ownerSlug);
					}
					graph.set(target, dependents);
				}
			}
		}
		// Recurse into nested field types
		if ('fields' in field && Array.isArray(field.fields)) {
			scanFieldsForRelationships(ownerSlug, field.fields, graph);
		}
		if ('tabs' in field && Array.isArray(field.tabs)) {
			for (const tab of field.tabs) {
				if ('fields' in tab && Array.isArray(tab.fields)) {
					scanFieldsForRelationships(ownerSlug, tab.fields, graph);
				}
			}
		}
		if ('blocks' in field && Array.isArray(field.blocks)) {
			for (const block of field.blocks) {
				if ('fields' in block && Array.isArray(block.fields)) {
					scanFieldsForRelationships(ownerSlug, block.fields, graph);
				}
			}
		}
	}
}

/**
 * Invalidate a collection's cache, plus any collections that depend on it
 * via relationship fields.
 */
async function invalidateWithDependents(
	slug: string,
	adapter: CacheAdapter,
	dependencyGraph: Map<string, string[]>,
	logger: PluginLogger | undefined,
	logHitMiss: boolean,
): Promise<void> {
	const count = await adapter.deleteByTag(slug);
	if (logHitMiss && logger) {
		logger.debug(`Cache invalidated: ${slug} (${count} entries)`);
	}

	// Invalidate dependent collections
	const dependents = dependencyGraph.get(slug);
	if (dependents) {
		for (const dep of dependents) {
			const depCount = await adapter.deleteByTag(dep);
			if (logHitMiss && logger && depCount > 0) {
				logger.debug(`Cache cascade invalidated: ${dep} (${depCount} entries, depends on ${slug})`);
			}
		}
	}
}

/**
 * Result of injecting cache invalidation hooks.
 */
export interface CacheInvalidationResult {
	/** Invalidate a global's cache by slug */
	invalidateGlobal: (slug: string) => Promise<void>;
}

/**
 * Inject cache invalidation hooks into collections.
 * Optionally accepts global configs to support global invalidation.
 */
export function injectCacheInvalidationHooks(
	collections: CollectionConfig[],
	adapter: CacheAdapter,
	dependencyGraph: Map<string, string[]>,
	excludeSet: Set<string>,
	logger: PluginLogger | undefined,
	logHitMiss: boolean,
	_globalConfigs?: Array<{ slug: string }>,
): CacheInvalidationResult {
	for (const collection of collections) {
		if (excludeSet.has(collection.slug)) continue;

		collection.hooks = collection.hooks ?? {};

		const afterChangeHook: HookFunction = async () => {
			await invalidateWithDependents(collection.slug, adapter, dependencyGraph, logger, logHitMiss);
		};

		const afterDeleteHook: HookFunction = async () => {
			await invalidateWithDependents(collection.slug, adapter, dependencyGraph, logger, logHitMiss);
		};

		collection.hooks.afterChange = [...(collection.hooks.afterChange ?? []), afterChangeHook];
		collection.hooks.afterDelete = [...(collection.hooks.afterDelete ?? []), afterDeleteHook];
	}

	return {
		async invalidateGlobal(slug: string): Promise<void> {
			const count = await adapter.deleteByTag(`global:${slug}`);
			if (logHitMiss && logger) {
				logger.debug(`Cache invalidated global: ${slug} (${count} entries)`);
			}
		},
	};
}

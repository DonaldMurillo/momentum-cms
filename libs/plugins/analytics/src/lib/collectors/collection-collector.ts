/**
 * Collection Collector
 *
 * Injects afterChange and afterDelete hooks that emit analytics events
 * for collection CRUD operations.
 */

import { randomUUID } from 'node:crypto';
import type { CollectionConfig, HookFunction } from '@momentumcms/core';
import type { AnalyticsEvent } from '../analytics-event.types';

/**
 * Callback type for analytics event emission.
 */
export type AnalyticsEmitter = (event: AnalyticsEvent) => void;

/**
 * Options for the collection collector.
 */
export interface CollectionCollectorOptions {
	/** Collections to exclude from tracking */
	excludeCollections?: string[];
}

/**
 * Inject collection tracking hooks into all collections.
 *
 * @param collections - Mutable collections array
 * @param emitter - Callback to emit analytics events
 * @param options - Collector options
 */
export function injectCollectionCollector(
	collections: CollectionConfig[],
	emitter: AnalyticsEmitter,
	options: CollectionCollectorOptions = {},
): void {
	const excluded = new Set(options.excludeCollections ?? []);

	for (const collection of collections) {
		if (excluded.has(collection.slug)) continue;

		collection.hooks = collection.hooks ?? {};

		// afterChange: track create/update
		const afterChangeHook: HookFunction = (args) => {
			const operation = args.operation ?? 'create';
			const doc = args.doc ?? args.data ?? {};

			const event: AnalyticsEvent = {
				id: randomUUID(),
				category: 'content',
				name: operation === 'create' ? 'content_created' : 'content_updated',
				timestamp: new Date().toISOString(),
				properties: {
					documentId: doc['id'],
				},
				context: {
					source: 'server',
					collection: collection.slug,
					operation,
				},
			};

			emitter(event);
		};

		const existingAfterChange = collection.hooks.afterChange ?? [];
		collection.hooks.afterChange = [...existingAfterChange, afterChangeHook];

		// afterDelete: track delete
		const afterDeleteHook: HookFunction = (args) => {
			const doc = args.doc ?? {};

			const event: AnalyticsEvent = {
				id: randomUUID(),
				category: 'content',
				name: 'content_deleted',
				timestamp: new Date().toISOString(),
				properties: {
					documentId: doc['id'],
				},
				context: {
					source: 'server',
					collection: collection.slug,
					operation: 'delete',
				},
			};

			emitter(event);
		};

		const existingAfterDelete = collection.hooks.afterDelete ?? [];
		collection.hooks.afterDelete = [...existingAfterDelete, afterDeleteHook];
	}
}

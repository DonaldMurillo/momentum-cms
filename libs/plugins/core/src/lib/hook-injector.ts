/**
 * Hook Injector
 *
 * Utility to inject collection event hooks that emit CollectionEvents.
 * Mirrors the pattern from registerWebhookHooks() in webhooks.ts.
 */

import type { CollectionConfig, HookFunction } from '@momentum-cms/core';
import type { CollectionEvent, CollectionEventType } from './plugin.types';

/**
 * Callback type for collection event listeners.
 */
export type CollectionEventListener = (event: CollectionEvent) => void;

/**
 * Injects afterChange and afterDelete hooks into collections that emit events.
 *
 * @param collections - Mutable collections array
 * @param listener - Callback invoked for each collection event
 */
export function injectCollectionEventHooks(
	collections: CollectionConfig[],
	listener: CollectionEventListener,
): void {
	for (const collection of collections) {
		collection.hooks = collection.hooks ?? {};

		// afterChange hook (fires on create and update)
		const afterChangeHook: HookFunction = (args) => {
			const operation = args.operation ?? 'create';
			const eventType: CollectionEventType = operation === 'create' ? 'afterChange' : 'afterChange';

			const event: CollectionEvent = {
				collection: collection.slug,
				event: eventType,
				operation,
				doc: args.doc ?? args.data,
				previousDoc: args.originalDoc,
				timestamp: new Date().toISOString(),
			};

			listener(event);
		};

		const existingAfterChange = collection.hooks.afterChange ?? [];
		collection.hooks.afterChange = [...existingAfterChange, afterChangeHook];

		// afterDelete hook
		const afterDeleteHook: HookFunction = (args) => {
			const event: CollectionEvent = {
				collection: collection.slug,
				event: 'afterDelete',
				operation: 'delete',
				doc: args.doc,
				timestamp: new Date().toISOString(),
			};

			listener(event);
		};

		const existingAfterDelete = collection.hooks.afterDelete ?? [];
		collection.hooks.afterDelete = [...existingAfterDelete, afterDeleteHook];
	}
}

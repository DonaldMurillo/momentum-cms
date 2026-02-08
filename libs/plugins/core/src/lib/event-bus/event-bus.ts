/**
 * Momentum Event Bus
 *
 * Lightweight pub/sub with pattern matching for collection events.
 *
 * Patterns:
 * - "posts:afterChange" — specific collection + event
 * - "*:afterDelete" — any collection, specific event
 * - "posts:*" — specific collection, any event
 * - "*" — all events
 */

import type { CollectionEvent, CollectionEventType } from '../plugin.types';

/**
 * Event handler callback.
 */
export type EventHandler = (event: CollectionEvent) => void;

/**
 * Subscription pattern string.
 * Format: "collection:event" where either part can be "*" for wildcard.
 */
export type EventPattern = string;

/**
 * Internal subscription record.
 */
interface Subscription {
	pattern: EventPattern;
	handler: EventHandler;
}

/**
 * Lightweight pub/sub event bus for collection events.
 */
export class MomentumEventBus {
	private subscriptions: Subscription[] = [];

	/**
	 * Subscribe to events matching a pattern.
	 *
	 * @param pattern - Pattern string: "collection:event", "*:event", "collection:*", or "*"
	 * @param handler - Callback invoked when a matching event occurs
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * bus.on('posts:afterChange', (event) => { ... });
	 * bus.on('*:afterDelete', (event) => { ... });
	 * const unsub = bus.on('*', (event) => { ... });
	 * unsub(); // remove subscription
	 * ```
	 */
	on(pattern: EventPattern, handler: EventHandler): () => void {
		const subscription: Subscription = { pattern, handler };
		this.subscriptions.push(subscription);

		return () => {
			const index = this.subscriptions.indexOf(subscription);
			if (index !== -1) {
				this.subscriptions.splice(index, 1);
			}
		};
	}

	/**
	 * Subscribe to all events for a specific collection.
	 * Shorthand for `on("collection:*", handler)`.
	 */
	onCollection(collection: string, handler: EventHandler): () => void {
		return this.on(`${collection}:*`, handler);
	}

	/**
	 * Subscribe to a specific event type across all collections.
	 * Shorthand for `on("*:event", handler)`.
	 */
	onEvent(event: CollectionEventType, handler: EventHandler): () => void {
		return this.on(`*:${event}`, handler);
	}

	/**
	 * Emit a collection event to all matching subscribers.
	 */
	emit(event: CollectionEvent): void {
		for (const sub of this.subscriptions) {
			if (matchesPattern(sub.pattern, event.collection, event.event)) {
				sub.handler(event);
			}
		}
	}

	/**
	 * Remove all subscriptions.
	 */
	clear(): void {
		this.subscriptions = [];
	}

	/**
	 * Get the current number of subscriptions.
	 */
	get size(): number {
		return this.subscriptions.length;
	}
}

/**
 * Check if an event matches a subscription pattern.
 */
function matchesPattern(
	pattern: EventPattern,
	collection: string,
	event: CollectionEventType,
): boolean {
	// Global wildcard
	if (pattern === '*') {
		return true;
	}

	const parts = pattern.split(':');
	if (parts.length !== 2) {
		return false;
	}

	const [patternCollection, patternEvent] = parts;

	const collectionMatch = patternCollection === '*' || patternCollection === collection;
	const eventMatch = patternEvent === '*' || patternEvent === event;

	return collectionMatch && eventMatch;
}

/**
 * Shared mutable state for test infrastructure endpoints.
 * Used by individual h3 route handlers to share webhook and event bus data.
 */

import type { CollectionEvent } from '@momentum-cms/plugins/core';

/**
 * In-memory webhook receiver storage.
 */
export const receivedWebhooks: Array<{
	headers: Record<string, string>;
	body: unknown;
	timestamp: number;
}> = [];

/**
 * In-memory event bus log.
 */
export const eventBusLog: CollectionEvent[] = [];

/**
 * Whether the event bus listener has been registered.
 */
export let eventBusListenerRegistered = false;

export function markEventBusListenerRegistered(): void {
	eventBusListenerRegistered = true;
}

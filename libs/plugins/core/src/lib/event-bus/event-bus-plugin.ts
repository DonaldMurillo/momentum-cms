/**
 * Event Bus Plugin
 *
 * A Momentum plugin that wires the event bus to collection hooks.
 * Events are emitted for all collection CRUD operations.
 *
 * @example
 * ```typescript
 * import { eventBusPlugin } from '@momentumcms/plugins/core';
 *
 * const events = eventBusPlugin();
 *
 * // Subscribe to events
 * events.bus.on('posts:afterChange', (event) => {
 *   // cache invalidation, notifications, etc.
 * });
 *
 * // Register in config
 * export default defineMomentumConfig({
 *   plugins: [events],
 *   // ...
 * });
 * ```
 */

import type { MomentumPlugin } from '../plugin.types';
import { injectCollectionEventHooks } from '../hook-injector';
import { MomentumEventBus } from './event-bus';

/**
 * Event bus plugin with an accessible bus instance.
 */
export interface EventBusPlugin extends MomentumPlugin {
	/** The event bus instance — subscribe to events here */
	bus: MomentumEventBus;
}

/**
 * Creates an event bus plugin.
 *
 * The returned object has a `.bus` property for subscribing to events,
 * and implements MomentumPlugin for lifecycle integration.
 *
 * @returns Plugin instance with event bus
 */
export function eventBusPlugin(): EventBusPlugin {
	const bus = new MomentumEventBus();

	return {
		name: 'event-bus',
		bus,

		onInit({ collections, logger }) {
			logger.info('Injecting event hooks into collections');
			injectCollectionEventHooks(collections, (event) => {
				bus.emit(event);
			});
			logger.info(`Event hooks injected into ${collections.length} collections`);
		},

		onShutdown({ logger }) {
			logger.info('Clearing event bus subscriptions');
			bus.clear();
		},
	};
}

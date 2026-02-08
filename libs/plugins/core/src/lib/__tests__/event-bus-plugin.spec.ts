import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBusPlugin } from '../event-bus/event-bus-plugin';
import type { CollectionConfig, MomentumConfig } from '@momentum-cms/core';
import type { CollectionEvent, PluginContext } from '../plugin.types';
import { resetMomentumLogger, createLogger } from '@momentum-cms/logger';

function createMockConfig(): MomentumConfig {
	return {
		db: { adapter: {} as MomentumConfig['db']['adapter'] },
		collections: [],
	};
}

function createMockContext(overrides: Partial<PluginContext> = {}): PluginContext {
	return {
		config: createMockConfig(),
		collections: [],
		logger: createLogger('test'),
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
		...overrides,
	};
}

describe('eventBusPlugin', () => {
	beforeEach(() => {
		resetMomentumLogger();
	});

	it('should create a plugin with name "event-bus"', () => {
		const plugin = eventBusPlugin();
		expect(plugin.name).toBe('event-bus');
	});

	it('should expose a bus instance', () => {
		const plugin = eventBusPlugin();
		expect(plugin.bus).toBeDefined();
		expect(typeof plugin.bus.on).toBe('function');
		expect(typeof plugin.bus.emit).toBe('function');
	});

	it('should inject hooks into collections during onInit', () => {
		const plugin = eventBusPlugin();
		const collections: CollectionConfig[] = [
			{ slug: 'posts', fields: [] },
			{ slug: 'users', fields: [] },
		];

		plugin.onInit?.(createMockContext({ collections }));

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);
		expect(collections[1].hooks?.afterChange).toHaveLength(1);
		expect(collections[1].hooks?.afterDelete).toHaveLength(1);
	});

	it('should emit events through the bus when hooks fire', () => {
		const plugin = eventBusPlugin();
		const collections: CollectionConfig[] = [{ slug: 'posts', fields: [] }];

		const events: CollectionEvent[] = [];
		plugin.bus.on('*', (event) => events.push(event));

		plugin.onInit?.(createMockContext({ collections }));

		// Simulate afterChange hook
		const afterChangeHook = collections[0].hooks?.afterChange?.[0];
		afterChangeHook?.({
			req: {} as CollectionEvent['doc'],
			operation: 'create',
			doc: { id: '1', title: 'Test' },
		});

		expect(events).toHaveLength(1);
		expect(events[0].collection).toBe('posts');
		expect(events[0].event).toBe('afterChange');
	});

	it('should clear bus subscriptions during onShutdown', () => {
		const plugin = eventBusPlugin();

		plugin.bus.on('*', vi.fn());
		plugin.bus.on('posts:afterChange', vi.fn());

		expect(plugin.bus.size).toBe(2);

		plugin.onShutdown?.(createMockContext());

		expect(plugin.bus.size).toBe(0);
	});

	it('should support pattern-based subscriptions through the bus', () => {
		const plugin = eventBusPlugin();
		const collections: CollectionConfig[] = [
			{ slug: 'posts', fields: [] },
			{ slug: 'users', fields: [] },
		];

		const postsEvents: CollectionEvent[] = [];
		const deleteEvents: CollectionEvent[] = [];

		plugin.bus.onCollection('posts', (event) => postsEvents.push(event));
		plugin.bus.onEvent('afterDelete', (event) => deleteEvents.push(event));

		plugin.onInit?.(createMockContext({ collections }));

		// Fire posts afterChange
		collections[0].hooks?.afterChange?.[0]?.({
			req: {} as CollectionEvent['doc'],
			operation: 'create',
			doc: { id: '1' },
		});

		// Fire users afterDelete
		collections[1].hooks?.afterDelete?.[0]?.({
			req: {} as CollectionEvent['doc'],
			operation: 'delete',
			doc: { id: '2' },
		});

		// Fire posts afterDelete
		collections[0].hooks?.afterDelete?.[0]?.({
			req: {} as CollectionEvent['doc'],
			operation: 'delete',
			doc: { id: '3' },
		});

		expect(postsEvents).toHaveLength(2); // posts:afterChange + posts:afterDelete
		expect(deleteEvents).toHaveLength(2); // users:afterDelete + posts:afterDelete
	});
});

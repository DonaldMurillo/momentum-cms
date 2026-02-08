import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsPlugin } from '../analytics-plugin';
import { MemoryAnalyticsAdapter } from '../adapters/memory-adapter';
import type { AnalyticsConfig } from '../analytics-config.types';
import type { CollectionConfig } from '@momentum-cms/core';
import type { MomentumLogger } from '@momentum-cms/logger';
import type { PluginContext, PluginMiddlewareDescriptor } from '@momentum-cms/plugins/core';

function createMockLogger(): MomentumLogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn().mockReturnThis(),
		context: 'Test',
	} as unknown as MomentumLogger;
}

function makeCollection(slug: string): CollectionConfig {
	return { slug, fields: [] } as CollectionConfig;
}

function createMockContext(overrides: Partial<PluginContext> = {}): PluginContext {
	return {
		config: {} as never,
		collections: [],
		logger: createMockLogger(),
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
		registerAdminRoute: vi.fn(),
		...overrides,
	};
}

describe('analyticsPlugin', () => {
	let adapter: MemoryAnalyticsAdapter;
	let config: AnalyticsConfig;

	beforeEach(() => {
		adapter = new MemoryAnalyticsAdapter();
		config = { adapter };
	});

	it('should have name "analytics"', () => {
		const plugin = analyticsPlugin(config);
		expect(plugin.name).toBe('analytics');
	});

	it('should expose the event store', () => {
		const plugin = analyticsPlugin(config);
		expect(plugin.eventStore).toBeDefined();
		expect(plugin.eventStore.size).toBe(0);
	});

	it('should expose the analytics config', () => {
		const plugin = analyticsPlugin(config);
		expect(plugin.analyticsConfig).toBe(config);
	});

	it('should initialize the adapter if it has an initialize method', async () => {
		const initAdapter = new MemoryAnalyticsAdapter();
		initAdapter.initialize = vi.fn().mockResolvedValue(undefined);

		const plugin = analyticsPlugin({ adapter: initAdapter });
		await plugin.onInit!(createMockContext());

		expect(initAdapter.initialize).toHaveBeenCalledOnce();
	});

	it('should inject collection collectors during onInit', async () => {
		const collections = [makeCollection('posts'), makeCollection('users')];

		const plugin = analyticsPlugin(config);
		await plugin.onInit!(createMockContext({ collections }));

		// Collections should have hooks injected
		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);
		expect(collections[1].hooks?.afterChange).toHaveLength(1);
	});

	it('should respect excludeCollections config', async () => {
		const collections = [makeCollection('posts'), makeCollection('_seed_tracking')];

		const plugin = analyticsPlugin({
			...config,
			excludeCollections: ['_seed_tracking'],
		});
		await plugin.onInit!(createMockContext({ collections }));

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[1].hooks).toBeUndefined();
	});

	it('should skip collection tracking when trackCollections is false', async () => {
		const collections = [makeCollection('posts')];

		const plugin = analyticsPlugin({ ...config, trackCollections: false });
		await plugin.onInit!(createMockContext({ collections }));

		expect(collections[0].hooks).toBeUndefined();
	});

	it('should do nothing when disabled', async () => {
		const collections = [makeCollection('posts')];
		const logger = createMockLogger();
		const registerMiddleware = vi.fn();

		const plugin = analyticsPlugin({ ...config, enabled: false });
		await plugin.onInit!(createMockContext({ collections, logger, registerMiddleware }));

		expect(collections[0].hooks).toBeUndefined();
		expect(logger.info).toHaveBeenCalledWith('Analytics disabled');
		expect(registerMiddleware).not.toHaveBeenCalled();
	});

	it('should register ingest router, query router, and API collector middleware during onInit', async () => {
		const registeredMiddleware: PluginMiddlewareDescriptor[] = [];
		const registerMiddleware = vi.fn((d: PluginMiddlewareDescriptor) =>
			registeredMiddleware.push(d),
		);

		const plugin = analyticsPlugin(config);
		await plugin.onInit!(createMockContext({ registerMiddleware }));

		expect(registerMiddleware).toHaveBeenCalledTimes(3);

		// First: ingest router
		expect(registeredMiddleware[0].path).toBe('/analytics/collect');
		expect(registeredMiddleware[0].position).toBe('before-api');
		expect(registeredMiddleware[0].handler).toBeDefined();

		// Second: query router
		expect(registeredMiddleware[1].path).toBe('/analytics');
		expect(registeredMiddleware[1].position).toBe('before-api');
		expect(registeredMiddleware[1].handler).toBeDefined();

		// Third: API collector
		expect(registeredMiddleware[2].path).toBe('/');
		expect(registeredMiddleware[2].position).toBe('before-api');
		expect(registeredMiddleware[2].handler).toBeDefined();
	});

	it('should use custom ingestPath when configured', async () => {
		const registeredMiddleware: PluginMiddlewareDescriptor[] = [];
		const registerMiddleware = vi.fn((d: PluginMiddlewareDescriptor) =>
			registeredMiddleware.push(d),
		);

		const plugin = analyticsPlugin({ ...config, ingestPath: '/custom/ingest' });
		await plugin.onInit!(createMockContext({ registerMiddleware }));

		expect(registeredMiddleware[0].path).toBe('/custom/ingest');
	});

	it('should skip API collector when trackApi is false', async () => {
		const registeredMiddleware: PluginMiddlewareDescriptor[] = [];
		const registerMiddleware = vi.fn((d: PluginMiddlewareDescriptor) =>
			registeredMiddleware.push(d),
		);

		const plugin = analyticsPlugin({ ...config, trackApi: false });
		await plugin.onInit!(createMockContext({ registerMiddleware }));

		// Only ingest router + query router should be registered (not API collector)
		expect(registerMiddleware).toHaveBeenCalledTimes(2);
		expect(registeredMiddleware[0].path).toBe('/analytics/collect');
		expect(registeredMiddleware[1].path).toBe('/analytics');
	});

	it('should start the event store on onReady', async () => {
		const plugin = analyticsPlugin(config);
		const startSpy = vi.spyOn(plugin.eventStore, 'start');

		await plugin.onReady!({
			...createMockContext(),
			api: {} as never,
		});

		expect(startSpy).toHaveBeenCalledOnce();
	});

	it('should skip onReady when disabled', async () => {
		const plugin = analyticsPlugin({ ...config, enabled: false });
		const startSpy = vi.spyOn(plugin.eventStore, 'start');

		await plugin.onReady!({
			...createMockContext(),
			api: {} as never,
		});

		expect(startSpy).not.toHaveBeenCalled();
	});

	it('should flush and shutdown on onShutdown', async () => {
		const plugin = analyticsPlugin(config);
		const shutdownSpy = vi.spyOn(plugin.eventStore, 'shutdown');

		await plugin.onShutdown!(createMockContext());

		expect(shutdownSpy).toHaveBeenCalledOnce();
	});

	it('should call adapter.shutdown if available', async () => {
		const shutdownAdapter = new MemoryAnalyticsAdapter();
		shutdownAdapter.shutdown = vi.fn().mockResolvedValue(undefined);

		const plugin = analyticsPlugin({ adapter: shutdownAdapter });
		await plugin.onShutdown!(createMockContext());

		expect(shutdownAdapter.shutdown).toHaveBeenCalledOnce();
	});

	it('should wire events end-to-end: hook → event store → adapter', async () => {
		const collections = [makeCollection('posts')];

		const plugin = analyticsPlugin(config);
		await plugin.onInit!(createMockContext({ collections }));

		// Trigger the afterChange hook
		const hook = collections[0].hooks!.afterChange![0];
		hook({
			operation: 'create',
			doc: { id: 'doc-1' },
			data: {},
			collection: collections[0],
		});

		// Event should be in the store buffer
		expect(plugin.eventStore.size).toBe(1);

		// Flush to adapter
		await plugin.eventStore.flush();
		expect(adapter.events).toHaveLength(1);
		expect(adapter.events[0].name).toBe('content_created');
		expect(adapter.events[0].context.collection).toBe('posts');
	});
});

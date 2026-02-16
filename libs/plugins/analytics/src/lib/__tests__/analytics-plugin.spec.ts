import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsPlugin } from '../analytics-plugin';
import { MemoryAnalyticsAdapter } from '../adapters/memory-adapter';
import type { AnalyticsConfig } from '../analytics-config.types';
import type { CollectionConfig } from '@momentumcms/core';
import type { MomentumLogger } from '@momentumcms/logger';
import type { PluginContext, PluginMiddlewareDescriptor } from '@momentumcms/plugins/core';

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

		// Verify each middleware is registered by checking paths
		const paths = registeredMiddleware.map((m) => m.path);
		expect(paths).toContain('/analytics/collect'); // ingest router
		expect(paths).toContain('/'); // API collector

		// Three separate middleware at /analytics: query + content perf + tracking rules
		const analyticsPaths = registeredMiddleware.filter((m) => m.path === '/analytics');
		expect(analyticsPaths).toHaveLength(3);

		// All middleware should be before-api
		for (const mw of registeredMiddleware) {
			expect(mw.position).toBe('before-api');
			expect(mw.handler).toBeDefined();
		}

		// Total: ingest + query + api collector + content perf + tracking rules
		expect(registeredMiddleware).toHaveLength(5);
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

		// API collector at path '/' should NOT be registered
		const rootPaths = registeredMiddleware.filter((m) => m.path === '/');
		expect(rootPaths).toHaveLength(0);

		// ingest + query + content perf + tracking rules = 4
		expect(registeredMiddleware).toHaveLength(4);
	});

	it('should skip content performance middleware when contentPerformance is false', async () => {
		const registeredMiddleware: PluginMiddlewareDescriptor[] = [];
		const registerMiddleware = vi.fn((d: PluginMiddlewareDescriptor) =>
			registeredMiddleware.push(d),
		);

		const plugin = analyticsPlugin({ ...config, contentPerformance: false });
		await plugin.onInit!(createMockContext({ registerMiddleware }));

		// query + tracking rules = 2 at /analytics (no content perf)
		const analyticsPaths = registeredMiddleware.filter((m) => m.path === '/analytics');
		expect(analyticsPaths).toHaveLength(2);

		// ingest + query + api collector + tracking rules = 4
		expect(registeredMiddleware).toHaveLength(4);
	});

	it('should skip tracking rules middleware when trackingRules is false', async () => {
		const registeredMiddleware: PluginMiddlewareDescriptor[] = [];
		const registerMiddleware = vi.fn((d: PluginMiddlewareDescriptor) =>
			registeredMiddleware.push(d),
		);

		const collections: CollectionConfig[] = [];
		const plugin = analyticsPlugin({ ...config, trackingRules: false });
		await plugin.onInit!(createMockContext({ registerMiddleware, collections }));

		// query + content perf = 2 at /analytics (no tracking rules)
		const analyticsPaths = registeredMiddleware.filter((m) => m.path === '/analytics');
		expect(analyticsPaths).toHaveLength(2);

		// tracking-rules collection should NOT be injected
		expect(collections.some((c) => c.slug === 'tracking-rules')).toBe(false);

		// ingest + query + api collector + content perf = 4
		expect(registeredMiddleware).toHaveLength(4);
	});

	it('should inject tracking-rules collection when trackingRules is enabled', async () => {
		const collections: CollectionConfig[] = [];

		const plugin = analyticsPlugin(config);
		await plugin.onInit!(createMockContext({ collections }));

		expect(collections.some((c) => c.slug === 'tracking-rules')).toBe(true);
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

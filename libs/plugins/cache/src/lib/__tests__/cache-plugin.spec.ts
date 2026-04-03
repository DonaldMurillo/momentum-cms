import { describe, it, expect, vi } from 'vitest';
import { cachePlugin } from '../cache-plugin';
import { LRUCacheAdapter } from '../adapters/lru-adapter';
import type { PluginContext, PluginReadyContext } from '@momentumcms/plugins/core';
import type { CollectionConfig, MomentumConfig } from '@momentumcms/core';

function makeContext(
	collections: CollectionConfig[] = [],
	overrides?: Partial<PluginContext>,
): PluginContext {
	return {
		config: {
			collections,
			globals: [],
		} as unknown as MomentumConfig,
		collections,
		logger: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
		...overrides,
	};
}

describe('cachePlugin', () => {
	it('should create a plugin with name "cache"', () => {
		const plugin = cachePlugin();
		expect(plugin.name).toBe('cache');
	});

	it('should expose the adapter', () => {
		const plugin = cachePlugin();
		expect(plugin.adapter).toBeInstanceOf(LRUCacheAdapter);
	});

	it('should accept custom adapter', () => {
		const adapter = new LRUCacheAdapter({ maxSize: 500 });
		const plugin = cachePlugin({ adapter });
		expect(plugin.adapter).toBe(adapter);
	});

	it('should have admin routes by default', () => {
		const plugin = cachePlugin();
		expect(plugin.adminRoutes).toHaveLength(1);
		expect(plugin.adminRoutes?.[0]?.path).toBe('cache');
	});

	it('should disable admin routes when configured', () => {
		const plugin = cachePlugin({ adminDashboard: false });
		expect(plugin.adminRoutes).toHaveLength(0);
	});

	it('should have browser imports', () => {
		const plugin = cachePlugin();
		expect(plugin.browserImports?.adminRoutes?.path).toBe(
			'@momentumcms/plugins-cache/admin-routes',
		);
	});

	describe('onInit', () => {
		it('should register cache middleware', async () => {
			const plugin = cachePlugin();
			const ctx = makeContext();
			await plugin.onInit?.(ctx);

			expect(ctx.registerMiddleware).toHaveBeenCalledTimes(2); // cache + management
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/', position: 'before-api' }),
			);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/cache', position: 'before-api' }),
			);
		});

		it('should auto-exclude auth collections', async () => {
			const authCollection = {
				slug: 'users',
				fields: [],
				labels: { singular: 'User', plural: 'Users' },
				auth: true,
			} as unknown as CollectionConfig;

			const plugin = cachePlugin();
			const ctx = makeContext([authCollection]);
			await plugin.onInit?.(ctx);

			// The collection should not have invalidation hooks
			// (excluded from caching entirely)
			expect(authCollection.hooks?.afterChange).toBeUndefined();
		});

		it('should inject invalidation hooks on cacheable collections', async () => {
			const collection = {
				slug: 'posts',
				fields: [{ name: 'title', type: 'text' }],
				labels: { singular: 'Post', plural: 'Posts' },
			} as unknown as CollectionConfig;

			const plugin = cachePlugin();
			const ctx = makeContext([collection]);
			await plugin.onInit?.(ctx);

			expect(collection.hooks?.afterChange).toHaveLength(1);
			expect(collection.hooks?.afterDelete).toHaveLength(1);
		});

		it('should initialize adapter if it has initialize method', async () => {
			const adapter = new LRUCacheAdapter();
			adapter.initialize = vi.fn().mockResolvedValue(undefined);

			const plugin = cachePlugin({ adapter });
			const ctx = makeContext();
			await plugin.onInit?.(ctx);

			expect(adapter.initialize).toHaveBeenCalled();
		});

		it('should log initialization info', async () => {
			const plugin = cachePlugin();
			const ctx = makeContext([
				{
					slug: 'posts',
					fields: [],
					labels: { singular: 'Post', plural: 'Posts' },
				} as unknown as CollectionConfig,
			]);
			await plugin.onInit?.(ctx);

			expect(ctx.logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Cache plugin initialized'),
			);
		});
	});

	describe('onReady', () => {
		it('should log ready', async () => {
			const plugin = cachePlugin();
			const ctx = makeContext() as PluginReadyContext;
			(ctx as PluginReadyContext).api = {} as PluginReadyContext['api'];
			await plugin.onReady?.(ctx);

			expect(ctx.logger.info).toHaveBeenCalledWith('Cache ready');
		});
	});

	describe('onShutdown', () => {
		it('should shutdown adapter if it has shutdown method', async () => {
			const adapter = new LRUCacheAdapter();
			adapter.shutdown = vi.fn().mockResolvedValue(undefined);

			const plugin = cachePlugin({ adapter });
			const ctx = makeContext();
			await plugin.onShutdown?.(ctx);

			expect(adapter.shutdown).toHaveBeenCalled();
		});

		it('should log shutdown', async () => {
			const plugin = cachePlugin();
			const ctx = makeContext();
			await plugin.onShutdown?.(ctx);

			expect(ctx.logger.info).toHaveBeenCalledWith('Cache shut down');
		});
	});
});

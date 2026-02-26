import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirectsPlugin } from '../redirects-plugin';
import type { PluginContext, PluginReadyContext, MomentumAPI } from '@momentumcms/plugins/core';
import type { CollectionConfig } from '@momentumcms/core';

function makePluginContext(collections: CollectionConfig[] = []): PluginContext {
	return {
		collections,
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		registerMiddleware: vi.fn(),
	} as unknown as PluginContext;
}

function makeMomentumApi(): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs: [] }),
		}),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;
}

function makeReadyContext(api?: MomentumAPI): PluginReadyContext {
	return {
		api: api ?? makeMomentumApi(),
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
	} as unknown as PluginReadyContext;
}

describe('redirectsPlugin', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a plugin with name "redirects"', () => {
		const plugin = redirectsPlugin();
		expect(plugin.name).toBe('redirects');
	});

	it('should declare redirects collection statically for the admin config generator', () => {
		const plugin = redirectsPlugin();
		expect(plugin.collections).toBeDefined();
		expect(plugin.collections).toHaveLength(1);
		expect(plugin.collections?.[0].slug).toBe('redirects');
	});

	describe('onInit', () => {
		it('should push redirects collection to context.collections', async () => {
			const plugin = redirectsPlugin();
			const collections: CollectionConfig[] = [];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'redirects')).toBe(true);
		});

		it('should not duplicate collection on re-init', async () => {
			const plugin = redirectsPlugin();
			const collections: CollectionConfig[] = [];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			await plugin.onInit?.(ctx);
			const redirectCollections = collections.filter((c) => c.slug === 'redirects');
			expect(redirectCollections).toHaveLength(1);
		});

		it('should register root middleware at path "/"', async () => {
			const plugin = redirectsPlugin();
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/', position: 'root' }),
			);
		});

		it('should skip all setup when enabled is false', async () => {
			const plugin = redirectsPlugin({ enabled: false });
			const collections: CollectionConfig[] = [];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).not.toHaveBeenCalled();
			expect(collections).toHaveLength(0);
		});

		it('should register exactly one middleware regardless of cacheTtl', async () => {
			const plugin = redirectsPlugin({ cacheTtl: 5000 });
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledTimes(1);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/', position: 'root', handler: expect.anything() }),
			);
		});
	});

	describe('onReady', () => {
		it('should store the API reference and log ready', async () => {
			const plugin = redirectsPlugin();
			const api = makeMomentumApi();
			const readyCtx = makeReadyContext(api);
			await plugin.onReady?.(readyCtx);
			expect(readyCtx.logger.info).toHaveBeenCalledWith(expect.stringContaining('ready'));
		});

		it('should skip when enabled is false', async () => {
			const plugin = redirectsPlugin({ enabled: false });
			const readyCtx = makeReadyContext();
			await plugin.onReady?.(readyCtx);
			expect(readyCtx.logger.info).not.toHaveBeenCalled();
		});
	});

	describe('onShutdown', () => {
		it('should log shutdown gracefully', async () => {
			const plugin = redirectsPlugin();
			const shutdownCtx = {
				logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
			};
			await plugin.onShutdown?.(shutdownCtx as unknown as PluginContext);
			expect(shutdownCtx.logger.info).toHaveBeenCalled();
		});
	});
});

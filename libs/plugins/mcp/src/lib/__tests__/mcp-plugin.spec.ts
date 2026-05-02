import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpPlugin } from '../mcp-plugin';
import type { PluginContext, PluginReadyContext, MomentumAPI } from '@momentumcms/plugins/core';
import type { CollectionConfig } from '@momentumcms/core';

function makePluginContext(collections: CollectionConfig[] = []): PluginContext {
	return {
		config: { collections, globals: [] },
		collections,
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	} as unknown as PluginContext;
}

function makeMomentumApi(): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs: [] }),
		}),
		global: vi.fn().mockReturnValue({
			findOne: vi.fn().mockResolvedValue({}),
		}),
		getConfig: vi.fn().mockReturnValue({ collections: [], globals: [] }),
		setContext: vi.fn().mockReturnThis(),
	} as unknown as MomentumAPI;
}

function makeReadyContext(api?: MomentumAPI): PluginReadyContext {
	return {
		api: api ?? makeMomentumApi(),
		config: { collections: [], globals: [] },
		collections: [],
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	} as unknown as PluginReadyContext;
}

describe('mcpPlugin', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a plugin with name "mcp"', () => {
		const plugin = mcpPlugin();
		expect(plugin.name).toBe('mcp');
	});

	describe('onInit', () => {
		it('should register middleware at the configured path', async () => {
			const plugin = mcpPlugin({ path: '/mcp' });
			const ctx = makePluginContext();
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/mcp',
					position: 'before-api',
					handler: expect.anything(),
				}),
			);
		});

		it('should default path to /mcp', async () => {
			const plugin = mcpPlugin();
			const ctx = makePluginContext();
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/mcp' }),
			);
		});

		it('should skip setup when enabled is false', async () => {
			const plugin = mcpPlugin({ enabled: false });
			const ctx = makePluginContext();
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).not.toHaveBeenCalled();
		});

		it('should register exactly one middleware', async () => {
			const plugin = mcpPlugin();
			const ctx = makePluginContext();
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledTimes(1);
		});
	});

	describe('onReady', () => {
		it('should store the API reference and log ready', async () => {
			const plugin = mcpPlugin();
			const api = makeMomentumApi();
			const readyCtx = makeReadyContext(api);
			await plugin.onReady?.(readyCtx);
			expect(readyCtx.logger.info).toHaveBeenCalledWith(expect.stringContaining('ready'));
		});

		it('should skip when enabled is false', async () => {
			const plugin = mcpPlugin({ enabled: false });
			const readyCtx = makeReadyContext();
			await plugin.onReady?.(readyCtx);
			expect(readyCtx.logger.info).not.toHaveBeenCalled();
		});
	});

	describe('onShutdown', () => {
		it('should log shutdown gracefully', async () => {
			const plugin = mcpPlugin();
			const ctx = makePluginContext();
			await plugin.onShutdown?.(ctx);
			expect(ctx.logger.info).toHaveBeenCalled();
		});

		it('should skip when enabled is false (no log, since onInit/onReady were no-ops)', async () => {
			const plugin = mcpPlugin({ enabled: false });
			const ctx = makePluginContext();
			await plugin.onShutdown?.(ctx);
			expect(ctx.logger.info).not.toHaveBeenCalled();
		});
	});
});

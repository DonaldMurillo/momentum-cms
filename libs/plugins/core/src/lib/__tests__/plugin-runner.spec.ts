import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginRunner } from '../plugin-runner';
import { PluginFatalError } from '../plugin-fatal-error';
import type { MomentumPlugin, MomentumAPI } from '../plugin.types';
import type { MomentumConfig, CollectionConfig } from '@momentum-cms/core';
import { resetMomentumLogger } from '@momentum-cms/logger';

function createMockConfig(): MomentumConfig {
	return {
		db: { adapter: {} as MomentumConfig['db']['adapter'] },
		collections: [],
	};
}

function createMockAPI(): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		}),
		getConfig: vi.fn().mockReturnValue(createMockConfig()),
	};
}

describe('PluginRunner', () => {
	beforeEach(() => {
		resetMomentumLogger();
	});

	it('should run onInit for all plugins in order', async () => {
		const order: string[] = [];
		const plugins: MomentumPlugin[] = [
			{
				name: 'first',
				onInit: () => {
					order.push('first');
				},
			},
			{
				name: 'second',
				onInit: () => {
					order.push('second');
				},
			},
			{
				name: 'third',
				onInit: () => {
					order.push('third');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		expect(order).toEqual(['first', 'second', 'third']);
	});

	it('should run onReady for all plugins in order', async () => {
		const order: string[] = [];
		const plugins: MomentumPlugin[] = [
			{
				name: 'alpha',
				onReady: () => {
					order.push('alpha');
				},
			},
			{
				name: 'beta',
				onReady: () => {
					order.push('beta');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runReady(createMockAPI());

		expect(order).toEqual(['alpha', 'beta']);
	});

	it('should run onShutdown in reverse order', async () => {
		const order: string[] = [];
		const plugins: MomentumPlugin[] = [
			{
				name: 'first',
				onShutdown: () => {
					order.push('first');
				},
			},
			{
				name: 'second',
				onShutdown: () => {
					order.push('second');
				},
			},
			{
				name: 'third',
				onShutdown: () => {
					order.push('third');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runShutdown();

		expect(order).toEqual(['third', 'second', 'first']);
	});

	it('should skip plugins without lifecycle methods', async () => {
		const initCalled = vi.fn();
		const plugins: MomentumPlugin[] = [
			{ name: 'no-hooks' },
			{ name: 'has-init', onInit: initCalled },
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		expect(initCalled).toHaveBeenCalledTimes(1);
	});

	it('should log and skip regular errors (fail-open)', async () => {
		const secondInit = vi.fn();
		const plugins: MomentumPlugin[] = [
			{
				name: 'broken',
				onInit: () => {
					throw new Error('Something went wrong');
				},
			},
			{ name: 'still-works', onInit: secondInit },
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		// Should not throw
		await runner.runInit();

		// Second plugin should still run
		expect(secondInit).toHaveBeenCalledTimes(1);
	});

	it('should rethrow PluginFatalError and stop execution', async () => {
		const secondInit = vi.fn();
		const plugins: MomentumPlugin[] = [
			{
				name: 'critical',
				onInit: () => {
					throw new PluginFatalError('critical', 'Cannot continue');
				},
			},
			{ name: 'never-reached', onInit: secondInit },
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await expect(runner.runInit()).rejects.toThrow(PluginFatalError);
		expect(secondInit).not.toHaveBeenCalled();
	});

	it('should rethrow PluginFatalError during onReady', async () => {
		const plugins: MomentumPlugin[] = [
			{
				name: 'critical',
				onReady: () => {
					throw new PluginFatalError('critical', 'DB not available');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await expect(runner.runReady(createMockAPI())).rejects.toThrow(PluginFatalError);
	});

	it('should log and skip errors during shutdown (never throw)', async () => {
		const secondShutdown = vi.fn();
		const plugins: MomentumPlugin[] = [
			{ name: 'first', onShutdown: secondShutdown },
			{
				name: 'broken',
				onShutdown: () => {
					throw new Error('Shutdown failed');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		// Should not throw (shutdown is reverse: broken runs first, then first)
		await runner.runShutdown();

		// First plugin should still run despite broken's error
		expect(secondShutdown).toHaveBeenCalledTimes(1);
	});

	it('should pass mutable collections to plugin context', async () => {
		const collections: CollectionConfig[] = [{ slug: 'posts', fields: [] }];
		let receivedCollections: CollectionConfig[] | undefined;

		const plugins: MomentumPlugin[] = [
			{
				name: 'inspector',
				onInit: (ctx) => {
					receivedCollections = ctx.collections;
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections,
			plugins,
		});

		await runner.runInit();

		expect(receivedCollections).toBe(collections);
	});

	it('should provide a scoped logger for each plugin', async () => {
		let loggerContext: string | undefined;

		const plugins: MomentumPlugin[] = [
			{
				name: 'my-plugin',
				onInit: (ctx) => {
					// The logger should be a child of the Plugins logger
					// with the plugin name as context
					loggerContext = ctx.logger.context;
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		expect(loggerContext).toContain('my-plugin');
	});

	it('should warn if runInit is called twice', async () => {
		const initFn = vi.fn();
		const plugins: MomentumPlugin[] = [{ name: 'once', onInit: initFn }];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();
		await runner.runInit(); // Second call should warn and skip

		expect(initFn).toHaveBeenCalledTimes(1);
	});

	it('should warn if runReady is called twice', async () => {
		const readyFn = vi.fn();
		const plugins: MomentumPlugin[] = [{ name: 'once', onReady: readyFn }];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runReady(createMockAPI());
		await runner.runReady(createMockAPI()); // Second call should warn and skip

		expect(readyFn).toHaveBeenCalledTimes(1);
	});

	it('should pass API to onReady context', async () => {
		const api = createMockAPI();
		let receivedApi: MomentumAPI | undefined;

		const plugins: MomentumPlugin[] = [
			{
				name: 'api-user',
				onReady: (ctx) => {
					receivedApi = ctx.api;
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runReady(api);

		expect(receivedApi).toBe(api);
	});

	it('should collect middleware registered during onInit', async () => {
		const fakeRouter = { handle: vi.fn() };
		const plugins: MomentumPlugin[] = [
			{
				name: 'middleware-plugin',
				onInit: (ctx) => {
					ctx.registerMiddleware({
						path: '/custom/endpoint',
						handler: fakeRouter,
						position: 'before-api',
					});
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		const middleware = runner.getMiddleware();
		expect(middleware).toHaveLength(1);
		expect(middleware[0].path).toBe('/custom/endpoint');
		expect(middleware[0].handler).toBe(fakeRouter);
		expect(middleware[0].position).toBe('before-api');
	});

	it('should collect providers registered during onInit', async () => {
		const fakeToken = Symbol('TEST_TOKEN');
		const plugins: MomentumPlugin[] = [
			{
				name: 'provider-plugin',
				onInit: (ctx) => {
					ctx.registerProvider({
						name: 'TestConfig',
						token: fakeToken,
						value: { endpoint: '/test' },
					});
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		const providers = runner.getProviders();
		expect(providers).toHaveLength(1);
		expect(providers[0].name).toBe('TestConfig');
		expect(providers[0].token).toBe(fakeToken);
		expect(providers[0].value).toEqual({ endpoint: '/test' });
	});

	it('should preserve registration order across multiple plugins', async () => {
		const plugins: MomentumPlugin[] = [
			{
				name: 'first',
				onInit: (ctx) => {
					ctx.registerMiddleware({ path: '/first', handler: 'handler-1' });
				},
			},
			{
				name: 'second',
				onInit: (ctx) => {
					ctx.registerMiddleware({ path: '/second-a', handler: 'handler-2a' });
					ctx.registerMiddleware({ path: '/second-b', handler: 'handler-2b' });
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		const middleware = runner.getMiddleware();
		expect(middleware).toHaveLength(3);
		expect(middleware.map((m) => m.path)).toEqual(['/first', '/second-a', '/second-b']);
	});

	it('should return empty arrays when no plugins register middleware/providers', async () => {
		const plugins: MomentumPlugin[] = [{ name: 'no-registrations' }];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();

		expect(runner.getMiddleware()).toEqual([]);
		expect(runner.getProviders()).toEqual([]);
	});

	it('should return plugin names', () => {
		const plugins: MomentumPlugin[] = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		expect(runner.getPluginNames()).toEqual(['alpha', 'beta', 'gamma']);
	});

	it('should handle async lifecycle methods', async () => {
		const order: string[] = [];
		const plugins: MomentumPlugin[] = [
			{
				name: 'async-plugin',
				async onInit() {
					await new Promise((resolve) => setTimeout(resolve, 10));
					order.push('init');
				},
				async onReady() {
					await new Promise((resolve) => setTimeout(resolve, 10));
					order.push('ready');
				},
				async onShutdown() {
					await new Promise((resolve) => setTimeout(resolve, 10));
					order.push('shutdown');
				},
			},
		];

		const runner = new PluginRunner({
			config: createMockConfig(),
			collections: [],
			plugins,
		});

		await runner.runInit();
		await runner.runReady(createMockAPI());
		await runner.runShutdown();

		expect(order).toEqual(['init', 'ready', 'shutdown']);
	});
});

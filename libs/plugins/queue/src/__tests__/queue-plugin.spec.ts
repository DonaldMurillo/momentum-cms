import { queuePlugin } from '../lib/queue-plugin';
import type { QueueAdapter, Job, PluginLogger, CollectionConfig } from '@momentumcms/core';

function createMockAdapter(): QueueAdapter {
	return {
		initialize: vi.fn(async () => undefined),
		enqueue: vi.fn(async () => ({}) as Job),
		fetchJobs: vi.fn(async () => []),
		completeJob: vi.fn(async () => undefined),
		failJob: vi.fn(async () => undefined),
		queryJobs: vi.fn(async () => ({ jobs: [], total: 0, page: 1, limit: 50 })),
		getStats: vi.fn(async () => []),
		getJob: vi.fn(async () => null),
		deleteJob: vi.fn(async () => true),
		purgeJobs: vi.fn(async () => 0),
		retryJob: vi.fn(async () => ({}) as Job),
		recoverStalledJobs: vi.fn(async () => 0),
		shutdown: vi.fn(async () => undefined),
	};
}

function createMockLogger(): PluginLogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('queuePlugin', () => {
	it('should have the correct name', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter });
		expect(plugin.name).toBe('queue');
	});

	it('should expose the adapter', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter });
		expect(plugin.adapter).toBe(adapter);
	});

	it('should declare the queue-jobs collection statically', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter });
		expect(plugin.collections).toHaveLength(1);
		expect(plugin.collections?.[0]?.slug).toBe('queue-jobs');
	});

	it('should declare admin routes by default', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter });
		expect(plugin.adminRoutes).toHaveLength(1);
		expect(plugin.adminRoutes?.[0]?.path).toBe('queue');
	});

	it('should not declare admin routes when disabled', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter, adminDashboard: false });
		expect(plugin.adminRoutes).toHaveLength(0);
	});

	it('should declare browserImports', () => {
		const adapter = createMockAdapter();
		const plugin = queuePlugin({ adapter });
		expect(plugin.browserImports?.adminRoutes?.path).toBe(
			'@momentumcms/plugins-queue/admin-routes',
		);
	});

	describe('onInit', () => {
		it('should push collection with idempotency guard', async () => {
			const adapter = createMockAdapter();
			const plugin = queuePlugin({ adapter });
			const collections: CollectionConfig[] = [];
			const registerMiddleware = vi.fn();
			const registerProvider = vi.fn();

			await plugin.onInit?.({
				config: {} as never,
				collections,
				logger: createMockLogger(),
				registerMiddleware,
				registerProvider,
			});

			expect(collections).toHaveLength(1);
			expect(collections[0]?.slug).toBe('queue-jobs');

			// Second call should not duplicate
			await plugin.onInit?.({
				config: {} as never,
				collections,
				logger: createMockLogger(),
				registerMiddleware,
				registerProvider,
			});
			expect(collections).toHaveLength(1);
		});

		it('should initialize the adapter', async () => {
			const adapter = createMockAdapter();
			const plugin = queuePlugin({ adapter });

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			expect(adapter.initialize).toHaveBeenCalled();
		});

		it('should register admin middleware', async () => {
			const adapter = createMockAdapter();
			const plugin = queuePlugin({ adapter });
			const registerMiddleware = vi.fn();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware,
				registerProvider: vi.fn(),
			});

			expect(registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/queue',
					position: 'before-api',
				}),
			);
		});
	});

	describe('enqueue', () => {
		it('should delegate to the adapter', async () => {
			const adapter = createMockAdapter();
			const plugin = queuePlugin({ adapter });

			await plugin.enqueue('test:job', { key: 'value' }, { queue: 'test' });

			expect(adapter.enqueue).toHaveBeenCalledWith('test:job', { key: 'value' }, { queue: 'test' });
		});
	});

	describe('registerHandler', () => {
		it('should register handlers that workers use to process jobs', async () => {
			const adapter = createMockAdapter();
			const job: Job = {
				id: 'job-1',
				type: 'test:job',
				payload: { key: 'value' },
				status: 'active',
				queue: 'default',
				priority: 5,
				attempts: 1,
				maxRetries: 3,
				backoff: { type: 'exponential', delay: 1000 },
				timeout: 30000,
				runAt: null,
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			};
			(adapter.fetchJobs as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce([job])
				.mockResolvedValue([]);

			const handler = vi.fn(async () => undefined);
			const plugin = queuePlugin({ adapter });
			plugin.registerHandler('test:job', handler);

			// Run onReady to start workers which consume registered handlers
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				api: {} as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			// Wait for the job to be processed
			await vi.waitFor(
				() => {
					expect(handler).toHaveBeenCalledWith(
						{ key: 'value' },
						job,
						expect.objectContaining({ logger: expect.anything() }),
					);
				},
				{ timeout: 2000 },
			);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('onShutdown', () => {
		it('should call adapter.shutdown', async () => {
			const adapter = createMockAdapter();
			const plugin = queuePlugin({ adapter });

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			expect(adapter.shutdown).toHaveBeenCalled();
		});
	});
});

import { cronPlugin } from '../lib/cron-plugin';
import type { CronPluginInstance } from '../lib/cron-plugin';
import type { QueuePluginInstance } from '@momentumcms/plugins/queue';
import type { QueueAdapter, Job, PluginLogger, CollectionConfig } from '@momentumcms/core';

function createMockQueuePlugin(): QueuePluginInstance {
	const mockAdapter: QueueAdapter = {
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

	return {
		name: 'queue',
		adapter: mockAdapter,
		registerHandler: vi.fn(),
		enqueue: vi.fn(async () => ({}) as Job),
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

interface MockDoc {
	id: string;
	name: string;
	type: string;
	cron: string;
	payload?: unknown;
	queue?: string;
	priority?: number;
	maxRetries?: number;
	timeout?: number;
	enabled?: boolean;
	nextRunAt?: string;
	lastRunAt?: string;
}

function createMockCollection(): {
	collection: Record<string, ReturnType<typeof vi.fn>>;
	docs: MockDoc[];
} {
	const docs: MockDoc[] = [];
	let nextId = 1;

	const collection = {
		find: vi.fn(async (opts?: { where?: Record<string, unknown>; limit?: number }) => {
			let results = [...docs];
			const where = opts?.where;
			if (where) {
				if ('name' in where) {
					const nameFilter = where['name'];
					if (typeof nameFilter === 'object' && nameFilter !== null && 'equals' in nameFilter) {
						results = results.filter((d) => d.name === (nameFilter as { equals: string }).equals);
					}
				}
				if ('and' in where) {
					const conditions = where['and'];
					if (Array.isArray(conditions)) {
						for (const cond of conditions) {
							if (typeof cond === 'object' && cond !== null) {
								if ('enabled' in cond) {
									const ef = cond['enabled'];
									if (typeof ef === 'object' && ef !== null && 'equals' in ef) {
										results = results.filter(
											(d) => d.enabled === (ef as { equals: boolean }).equals,
										);
									}
								}
								if ('nextRunAt' in cond) {
									const nf = cond['nextRunAt'];
									if (typeof nf === 'object' && nf !== null && 'less_than_equal' in nf) {
										const threshold = (nf as { less_than_equal: string }).less_than_equal;
										results = results.filter(
											(d) => d.nextRunAt !== undefined && d.nextRunAt <= threshold,
										);
									}
								}
							}
						}
					}
				}
			}
			return { docs: results };
		}),
		findById: vi.fn(async (id: string) => {
			return docs.find((d) => d.id === id);
		}),
		create: vi.fn(async (data: Omit<MockDoc, 'id'>) => {
			const doc = { ...data, id: `cron-${nextId++}` } as MockDoc;
			docs.push(doc);
			return doc;
		}),
		update: vi.fn(async (id: string, data: Partial<MockDoc>) => {
			const idx = docs.findIndex((d) => d.id === id);
			const existing = docs[idx];
			if (idx >= 0 && existing) {
				docs[idx] = { ...existing, ...data };
				return docs[idx];
			}
			return null;
		}),
		delete: vi.fn(async (id: string) => {
			const idx = docs.findIndex((d) => d.id === id);
			if (idx >= 0) {
				docs.splice(idx, 1);
			}
		}),
	};

	return { collection, docs };
}

function createMockApi(collection: Record<string, ReturnType<typeof vi.fn>>): {
	collection: (slug: string) => Record<string, ReturnType<typeof vi.fn>>;
} {
	return {
		collection: vi.fn(() => collection),
	};
}

async function setupReadyPlugin(
	queue: QueuePluginInstance,
	mockCollection: Record<string, ReturnType<typeof vi.fn>>,
): Promise<{ plugin: CronPluginInstance; logger: PluginLogger }> {
	const plugin = cronPlugin({ queue, checkInterval: 999999 });
	const logger = createMockLogger();

	await plugin.onInit?.({
		config: {} as never,
		collections: [],
		logger,
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	});

	const api = createMockApi(mockCollection);
	await plugin.onReady?.({
		config: {} as never,
		collections: [],
		logger,
		api: api as never,
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	});

	return { plugin, logger };
}

describe('cronPlugin', () => {
	it('should have the correct name', () => {
		const queue = createMockQueuePlugin();
		const plugin = cronPlugin({ queue });
		expect(plugin.name).toBe('cron');
	});

	it('should declare the cron-schedules collection statically', () => {
		const queue = createMockQueuePlugin();
		const plugin = cronPlugin({ queue });
		expect(plugin.collections).toHaveLength(1);
		expect(plugin.collections?.[0]?.slug).toBe('cron-schedules');
	});

	it('should declare admin routes by default', () => {
		const queue = createMockQueuePlugin();
		const plugin = cronPlugin({ queue });
		expect(plugin.adminRoutes).toHaveLength(1);
		expect(plugin.adminRoutes?.[0]?.path).toBe('cron');
	});

	it('should not declare admin routes when disabled', () => {
		const queue = createMockQueuePlugin();
		const plugin = cronPlugin({ queue, adminDashboard: false });
		expect(plugin.adminRoutes).toHaveLength(0);
	});

	it('should declare browserImports', () => {
		const queue = createMockQueuePlugin();
		const plugin = cronPlugin({ queue });
		expect(plugin.browserImports?.adminRoutes?.path).toBe('@momentumcms/plugins-cron/admin-routes');
	});

	describe('onInit', () => {
		it('should push collection with idempotency guard', async () => {
			const queue = createMockQueuePlugin();
			const plugin = cronPlugin({ queue });
			const collections: CollectionConfig[] = [];

			await plugin.onInit?.({
				config: {} as never,
				collections,
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			expect(collections).toHaveLength(1);
			expect(collections[0]?.slug).toBe('cron-schedules');

			// Second call should not duplicate
			await plugin.onInit?.({
				config: {} as never,
				collections,
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
			expect(collections).toHaveLength(1);
		});
	});

	describe('onShutdown', () => {
		it('should clear the check timer and log shutdown', async () => {
			const queue = createMockQueuePlugin();
			const { collection } = createMockCollection();
			const { plugin, logger } = await setupReadyPlugin(queue, collection);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			expect(logger.info).toHaveBeenCalledWith('Cron plugin shut down');
		});
	});

	describe('pre-ready errors', () => {
		it('should throw when addSchedule is called before onReady', async () => {
			const queue = createMockQueuePlugin();
			const plugin = cronPlugin({ queue });

			await expect(
				plugin.addSchedule({
					name: 'test',
					type: 'test:job',
					cron: '* * * * *',
				}),
			).rejects.toThrow('Cron plugin not ready yet');
		});

		it('should throw when removeSchedule is called before onReady', async () => {
			const queue = createMockQueuePlugin();
			const plugin = cronPlugin({ queue });

			await expect(plugin.removeSchedule('test')).rejects.toThrow('Cron plugin not ready yet');
		});

		it('should throw when getSchedules is called before onReady', async () => {
			const queue = createMockQueuePlugin();
			const plugin = cronPlugin({ queue });

			await expect(plugin.getSchedules()).rejects.toThrow('Cron plugin not ready yet');
		});
	});

	describe('onReady', () => {
		it('should sync static schedules to the database', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();

			const plugin = cronPlugin({
				queue,
				schedules: [
					{ name: 'daily-cleanup', type: 'maintenance:cleanup', cron: '0 2 * * *' },
					{ name: 'hourly-check', type: 'health:check', cron: '0 * * * *' },
				],
				checkInterval: 999999,
			});

			const logger = createMockLogger();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			const api = createMockApi(collection);
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger,
				api: api as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			// Both schedules should be persisted
			expect(docs).toHaveLength(2);
			expect(docs[0]?.name).toBe('daily-cleanup');
			expect(docs[0]?.type).toBe('maintenance:cleanup');
			expect(docs[1]?.name).toBe('hourly-check');
			expect(docs[1]?.type).toBe('health:check');
			expect(docs[0]?.nextRunAt).toBeDefined();
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Registered cron schedule: daily-cleanup'),
			);

			// Cleanup
			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});

		it('should log error for invalid cron expressions in static schedules', async () => {
			const queue = createMockQueuePlugin();
			const { collection } = createMockCollection();

			const plugin = cronPlugin({
				queue,
				schedules: [{ name: 'bad', type: 'test:job', cron: 'not-a-cron' }],
				checkInterval: 999999,
			});

			const logger = createMockLogger();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			const api = createMockApi(collection);
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger,
				api: api as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Invalid cron expression for "bad"'),
			);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('addSchedule', () => {
		it('should create a new schedule in the collection', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			await plugin.addSchedule({
				name: 'new-schedule',
				type: 'test:job',
				cron: '*/5 * * * *',
				queue: 'custom',
				priority: 2,
			});

			expect(docs).toHaveLength(1);
			expect(docs[0]?.name).toBe('new-schedule');
			expect(docs[0]?.type).toBe('test:job');
			expect(docs[0]?.cron).toBe('*/5 * * * *');
			expect(docs[0]?.queue).toBe('custom');
			expect(docs[0]?.priority).toBe(2);
			expect(docs[0]?.nextRunAt).toBeDefined();

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});

		it('should update an existing schedule by name', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			// Create initial
			await plugin.addSchedule({
				name: 'my-schedule',
				type: 'old:type',
				cron: '0 * * * *',
			});

			expect(docs).toHaveLength(1);
			expect(docs[0]?.type).toBe('old:type');

			// Update same name
			await plugin.addSchedule({
				name: 'my-schedule',
				type: 'new:type',
				cron: '*/10 * * * *',
			});

			// Still 1 doc, but updated
			expect(docs).toHaveLength(1);
			expect(docs[0]?.type).toBe('new:type');
			expect(docs[0]?.cron).toBe('*/10 * * * *');

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});

		it('should reject invalid cron expressions', async () => {
			const queue = createMockQueuePlugin();
			const { collection } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			await expect(
				plugin.addSchedule({
					name: 'bad',
					type: 'test:job',
					cron: 'invalid',
				}),
			).rejects.toThrow('Invalid cron expression');

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('removeSchedule', () => {
		it('should remove a schedule by name', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			await plugin.addSchedule({
				name: 'to-remove',
				type: 'test:job',
				cron: '0 * * * *',
			});
			expect(docs).toHaveLength(1);

			await plugin.removeSchedule('to-remove');
			expect(docs).toHaveLength(0);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});

		it('should be a no-op when schedule name does not exist', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			// Should not throw
			await plugin.removeSchedule('nonexistent');
			expect(docs).toHaveLength(0);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('checkDueSchedules race condition prevention', () => {
		it('should pass uniqueKey to enqueue to prevent duplicate cron jobs', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();

			// Create a schedule that is already due (nextRunAt in the past)
			const pastTime = new Date(Date.now() - 60000).toISOString();
			docs.push({
				id: 'cron-1',
				name: 'daily-cleanup',
				type: 'maintenance:cleanup',
				cron: '0 2 * * *',
				queue: 'default',
				priority: 5,
				maxRetries: 3,
				timeout: 30000,
				enabled: true,
				nextRunAt: pastTime,
			});

			// Use a short checkInterval so the scheduler fires quickly
			const plugin = cronPlugin({ queue, checkInterval: 50 });
			const logger = createMockLogger();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			const api = createMockApi(collection);
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger,
				api: api as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			// Wait for the scheduler to process the due schedule
			await vi.waitFor(
				() => {
					expect(queue.enqueue).toHaveBeenCalled();
				},
				{ timeout: 3000 },
			);

			// Verify uniqueKey was passed to prevent race conditions
			const enqueueCall = (queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0];
			const options = enqueueCall?.[2];
			expect(options).toBeDefined();
			expect(options.uniqueKey).toBe(`cron:daily-cleanup:${pastTime}`);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('schedule advancement resilience', () => {
		it('should advance nextRunAt before enqueue to prevent stuck schedules', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();

			const pastTime = new Date(Date.now() - 60000).toISOString();
			docs.push({
				id: 'cron-1',
				name: 'daily-cleanup',
				type: 'maintenance:cleanup',
				cron: '0 2 * * *',
				queue: 'default',
				priority: 5,
				maxRetries: 3,
				timeout: 30000,
				enabled: true,
				nextRunAt: pastTime,
			});

			// Track call order to verify update happens before enqueue
			const callOrder: string[] = [];
			(collection.update as ReturnType<typeof vi.fn>).mockImplementation(
				async (id: string, data: Partial<MockDoc>) => {
					callOrder.push('update');
					const idx = docs.findIndex((d) => d.id === id);
					const existing = docs[idx];
					if (idx >= 0 && existing) {
						docs[idx] = { ...existing, ...data };
						return docs[idx];
					}
					return null;
				},
			);
			(queue.enqueue as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				callOrder.push('enqueue');
				return {} as Job;
			});

			const plugin = cronPlugin({ queue, checkInterval: 50 });
			const logger = createMockLogger();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			const api = createMockApi(collection);
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger,
				api: api as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			await vi.waitFor(
				() => {
					expect(queue.enqueue).toHaveBeenCalled();
				},
				{ timeout: 3000 },
			);

			// update (advancing nextRunAt) must happen BEFORE enqueue
			expect(callOrder[0]).toBe('update');
			expect(callOrder[1]).toBe('enqueue');

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});

		it('should still advance schedule if enqueue fails', async () => {
			const queue = createMockQueuePlugin();
			const { collection, docs } = createMockCollection();

			const pastTime = new Date(Date.now() - 60000).toISOString();
			docs.push({
				id: 'cron-1',
				name: 'daily-cleanup',
				type: 'maintenance:cleanup',
				cron: '0 2 * * *',
				queue: 'default',
				priority: 5,
				maxRetries: 3,
				timeout: 30000,
				enabled: true,
				nextRunAt: pastTime,
			});

			// Make enqueue fail
			(queue.enqueue as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Connection refused'),
			);

			const plugin = cronPlugin({ queue, checkInterval: 50 });
			const logger = createMockLogger();

			await plugin.onInit?.({
				config: {} as never,
				collections: [],
				logger,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			const api = createMockApi(collection);
			await plugin.onReady?.({
				config: {} as never,
				collections: [],
				logger,
				api: api as never,
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});

			// Wait for the scheduler to attempt processing
			await vi.waitFor(
				() => {
					expect(queue.enqueue).toHaveBeenCalled();
				},
				{ timeout: 3000 },
			);

			// nextRunAt should have been advanced despite enqueue failure
			const schedule = docs.find((d) => d.id === 'cron-1');
			expect(schedule).toBeDefined();
			expect(schedule?.nextRunAt).not.toBe(pastTime);
			expect(collection.update).toHaveBeenCalled();

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});

	describe('getSchedules', () => {
		it('should return all schedules as RecurringJobDefinition[]', async () => {
			const queue = createMockQueuePlugin();
			const { collection } = createMockCollection();
			const { plugin } = await setupReadyPlugin(queue, collection);

			await plugin.addSchedule({
				name: 'sched-a',
				type: 'type:a',
				cron: '0 * * * *',
				queue: 'q1',
			});
			await plugin.addSchedule({
				name: 'sched-b',
				type: 'type:b',
				cron: '*/5 * * * *',
				priority: 1,
			});

			const schedules = await plugin.getSchedules();

			expect(schedules).toHaveLength(2);
			expect(schedules[0]?.name).toBe('sched-a');
			expect(schedules[0]?.type).toBe('type:a');
			expect(schedules[0]?.queue).toBe('q1');
			expect(schedules[1]?.name).toBe('sched-b');
			expect(schedules[1]?.priority).toBe(1);

			await plugin.onShutdown?.({
				config: {} as never,
				collections: [],
				logger: createMockLogger(),
				registerMiddleware: vi.fn(),
				registerProvider: vi.fn(),
			});
		});
	});
});

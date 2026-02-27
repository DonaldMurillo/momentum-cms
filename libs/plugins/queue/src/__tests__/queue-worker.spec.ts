import { QueueWorker } from '../lib/queue-worker';
import type { QueueAdapter, Job, MomentumAPI, PluginLogger } from '@momentumcms/core';
import type { JobHandler } from '../lib/queue-plugin-config.types';

function createMockAdapter(overrides: Partial<QueueAdapter> = {}): QueueAdapter {
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
		...overrides,
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

function createMockJob(overrides: Partial<Job> = {}): Job {
	return {
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
		...overrides,
	};
}

describe('QueueWorker', () => {
	it('should start and stop', async () => {
		const adapter = createMockAdapter();
		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 100,
			handlers: new Map(),
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();
		expect(worker.isRunning()).toBe(true);

		await worker.stop();
		expect(worker.isRunning()).toBe(false);
	});

	it('should process a job and call completeJob on success', async () => {
		const job = createMockJob();
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		const handler: JobHandler = vi.fn(async () => undefined);
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.completeJob).toHaveBeenCalledWith('job-1');
			},
			{ timeout: 2000 },
		);
		await worker.stop();

		expect(handler).toHaveBeenCalledWith(
			job.payload,
			job,
			expect.objectContaining({ api: expect.anything(), logger: expect.anything() }),
		);
	});

	it('should call failJob when handler throws', async () => {
		const job = createMockJob();
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		const handler: JobHandler = vi.fn(async () => {
			throw new Error('Handler failed');
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.failJob).toHaveBeenCalledWith('job-1', 'Handler failed');
			},
			{ timeout: 2000 },
		);
		await worker.stop();
	});

	it('should fail jobs with no registered handler', async () => {
		const job = createMockJob({ type: 'unknown:type' });
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers: new Map(),
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.failJob).toHaveBeenCalledWith(
					'job-1',
					'No handler registered for job type: unknown:type',
				);
			},
			{ timeout: 2000 },
		);
		await worker.stop();
	});

	it('should respect concurrency limits', async () => {
		let activeJobs = 0;
		let maxActiveJobs = 0;

		const allJobs = [
			createMockJob({ id: 'job-1', timeout: 5000 }),
			createMockJob({ id: 'job-2', timeout: 5000 }),
			createMockJob({ id: 'job-3', timeout: 5000 }),
		];

		// Mock that respects the limit parameter, like a real DB would
		const adapter = createMockAdapter({
			fetchJobs: vi.fn(async (opts?: { limit?: number }) => {
				const limit = opts?.limit ?? 1;
				const batch = allJobs.splice(0, limit);
				return batch;
			}),
		});

		const handler: JobHandler = vi.fn(async () => {
			activeJobs++;
			maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
			await new Promise((r) => setTimeout(r, 50));
			activeJobs--;
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 2, // Only 2 concurrent
			pollInterval: 10,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		// Wait for all 3 jobs to complete
		await vi.waitFor(
			() => {
				expect(handler).toHaveBeenCalledTimes(3);
			},
			{ timeout: 2000 },
		);
		await worker.stop();

		// First fetchJobs is called with limit matching available capacity
		expect((adapter.fetchJobs as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual({
			queue: 'default',
			limit: 2,
		});

		// At most 2 jobs ran concurrently despite 3 being available
		expect(maxActiveJobs).toBeLessThanOrEqual(2);
		expect(maxActiveJobs).toBeGreaterThan(0);
	});

	it('should fail job when handler exceeds timeout', async () => {
		const job = createMockJob({ id: 'timeout-job', timeout: 50 });
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		const handler: JobHandler = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 500)); // Exceeds 50ms timeout
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.failJob).toHaveBeenCalledWith('timeout-job', 'Job timed out after 50ms');
			},
			{ timeout: 2000 },
		);
		await worker.stop();

		// completeJob should NOT have been called
		expect(adapter.completeJob).not.toHaveBeenCalled();
	});

	it('should provide AbortSignal in handler context', async () => {
		const job = createMockJob();
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		let receivedSignal: AbortSignal | undefined;
		const handler: JobHandler = vi.fn(async (_payload, _job, context) => {
			receivedSignal = context.signal;
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.completeJob).toHaveBeenCalled();
			},
			{ timeout: 2000 },
		);
		await worker.stop();

		expect(receivedSignal).toBeInstanceOf(AbortSignal);
		expect(receivedSignal?.aborted).toBe(false); // Should not be aborted on success
	});

	it('should abort signal when job times out', async () => {
		const job = createMockJob({ id: 'timeout-abort', timeout: 50 });
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		let signalAborted = false;
		const handler: JobHandler = vi.fn(async (_payload, _job, context) => {
			// Wait long enough for timeout to fire
			await new Promise((r) => setTimeout(r, 200));
			signalAborted = context.signal.aborted;
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		await vi.waitFor(
			() => {
				expect(adapter.failJob).toHaveBeenCalled();
			},
			{ timeout: 2000 },
		);

		// Give handler time to observe the signal
		await new Promise((r) => setTimeout(r, 300));
		await worker.stop();

		expect(signalAborted).toBe(true);
	});

	it('should not produce unhandled rejection when handler throws after timeout', async () => {
		const job = createMockJob({ id: 'timeout-reject', timeout: 50 });
		const adapter = createMockAdapter({
			fetchJobs: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
		});

		// Track unhandled rejections — the bug causes process crash
		const unhandledRejections: unknown[] = [];
		const onUnhandled = (reason: unknown): void => {
			unhandledRejections.push(reason);
		};
		process.on('unhandledRejection', onUnhandled);

		const handler: JobHandler = vi.fn(async () => {
			// Wait past the timeout, then throw
			await new Promise((r) => setTimeout(r, 200));
			throw new Error('Handler failed after timeout');
		});
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger: createMockLogger(),
		});

		worker.start();

		// Wait for timeout-triggered failJob
		await vi.waitFor(
			() => {
				expect(adapter.failJob).toHaveBeenCalledWith('timeout-reject', 'Job timed out after 50ms');
			},
			{ timeout: 2000 },
		);

		// Wait for the orphaned handler to reject
		await new Promise((r) => setTimeout(r, 400));
		await worker.stop();

		process.removeListener('unhandledRejection', onUnhandled);

		// The bug: handler rejects after timeout with no .catch() → unhandled rejection
		expect(unhandledRejections).toHaveLength(0);
	});

	it('should continue polling after fetchJobs error', async () => {
		const job = createMockJob({ id: 'after-error' });
		const adapter = createMockAdapter({
			fetchJobs: vi
				.fn()
				.mockRejectedValueOnce(new Error('Connection lost'))
				.mockResolvedValueOnce([job])
				.mockResolvedValue([]),
		});

		const handler: JobHandler = vi.fn(async () => undefined);
		const handlers = new Map<string, JobHandler>();
		handlers.set('test:job', handler);

		const logger = createMockLogger();
		const worker = new QueueWorker({
			adapter,
			queue: 'default',
			concurrency: 1,
			pollInterval: 50,
			handlers,
			api: {} as MomentumAPI,
			logger,
		});

		worker.start();

		// Worker should recover: process the job on the second poll
		await vi.waitFor(
			() => {
				expect(adapter.completeJob).toHaveBeenCalledWith('after-error');
			},
			{ timeout: 2000 },
		);
		await worker.stop();

		// Error was logged
		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Connection lost'));
	});
});

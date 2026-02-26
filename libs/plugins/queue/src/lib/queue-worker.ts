import type { Job, MomentumAPI, PluginLogger, QueueAdapter } from '@momentumcms/core';
import type { JobHandler, JobHandlerContext } from './queue-plugin-config.types';

export interface QueueWorkerOptions {
	adapter: QueueAdapter;
	queue: string;
	concurrency: number;
	pollInterval: number;
	handlers: Map<string, JobHandler>;
	api: MomentumAPI;
	logger: PluginLogger;
}

/**
 * Queue worker that polls for jobs and processes them.
 * Supports concurrency control and graceful shutdown.
 */
export class QueueWorker {
	private running = false;
	private activeCount = 0;
	private pollTimer: ReturnType<typeof setTimeout> | null = null;
	private resolveStop: (() => void) | null = null;

	constructor(private readonly options: QueueWorkerOptions) {}

	/** Start the worker's poll loop. */
	start(): void {
		this.running = true;
		this.poll();
	}

	/**
	 * Gracefully stop the worker.
	 * Stops polling and waits for in-flight jobs to complete.
	 */
	async stop(): Promise<void> {
		this.running = false;
		if (this.pollTimer) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}

		if (this.activeCount > 0) {
			return new Promise<void>((resolve) => {
				this.resolveStop = resolve;
			});
		}
	}

	/** @internal For testing: get active job count */
	getActiveCount(): number {
		return this.activeCount;
	}

	/** @internal For testing: check if running */
	isRunning(): boolean {
		return this.running;
	}

	private poll(): void {
		if (!this.running) return;

		const available = this.options.concurrency - this.activeCount;
		if (available <= 0) {
			this.schedulePoll();
			return;
		}

		this.options.adapter
			.fetchJobs({
				queue: this.options.queue,
				limit: available,
			})
			.then((jobs) => {
				for (const job of jobs) {
					void this.processJob(job);
				}
				this.schedulePoll();
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				this.options.logger.error(`Poll error on queue "${this.options.queue}": ${msg}`);
				this.schedulePoll();
			});
	}

	private schedulePoll(): void {
		if (!this.running) return;
		this.pollTimer = setTimeout(() => this.poll(), this.options.pollInterval);
	}

	private async processJob(job: Job): Promise<void> {
		const handler = this.options.handlers.get(job.type);
		if (!handler) {
			this.options.logger.error(`No handler registered for job type: ${job.type}`);
			await this.options.adapter.failJob(job.id, `No handler registered for job type: ${job.type}`);
			return;
		}

		this.activeCount++;

		// Timeout guard with AbortController so handlers can observe cancellation
		const controller = new AbortController();
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutHandle = setTimeout(() => {
				controller.abort();
				reject(new Error(`Job timed out after ${job.timeout}ms`));
			}, job.timeout);
		});

		try {
			const context: JobHandlerContext = {
				api: this.options.api,
				logger: this.options.logger,
				enqueue: (type: string, payload: unknown, opts?: Parameters<QueueAdapter['enqueue']>[2]) =>
					this.options.adapter.enqueue(type, payload, opts),
				signal: controller.signal,
			};

			await Promise.race([handler(job.payload, job, context), timeoutPromise]);

			await this.options.adapter.completeJob(job.id);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			this.options.logger.error(`Job ${job.id} (${job.type}) failed: ${msg}`);
			await this.options.adapter.failJob(job.id, msg);
		} finally {
			if (timeoutHandle) clearTimeout(timeoutHandle);
			this.activeCount--;

			if (!this.running && this.activeCount === 0 && this.resolveStop) {
				this.resolveStop();
			}
		}
	}
}

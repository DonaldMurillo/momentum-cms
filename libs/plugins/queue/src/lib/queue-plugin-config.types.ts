import type {
	Job,
	MomentumAPI,
	PluginLogger,
	QueueAdapter,
	EnqueueOptions,
} from '@momentumcms/core';

/**
 * Job handler function.
 * Receives the job payload and must return void on success.
 * Throwing an error marks the job as failed.
 */
export type JobHandler<T = unknown> = (
	payload: T,
	job: Job<T>,
	context: JobHandlerContext,
) => Promise<void>;

/**
 * Context available to job handlers during execution.
 */
export interface JobHandlerContext {
	/** The Momentum API (for database operations within jobs) */
	api: MomentumAPI;
	/** Logger scoped to the job type */
	logger: PluginLogger;
	/** Enqueue another job (for chaining/spawning) */
	enqueue: (type: string, payload: unknown, options?: EnqueueOptions) => Promise<Job>;
	/** Abort signal — aborted when the job times out. Check `signal.aborted` before performing side effects. */
	signal: AbortSignal;
}

/**
 * Worker configuration for a specific queue.
 */
export interface WorkerConfig {
	/** Number of jobs to process concurrently. @default 1 */
	concurrency?: number;
	/** Polling interval in ms. @default 1000 */
	pollInterval?: number;
	/** Whether to start the worker. @default true */
	enabled?: boolean;
}

/**
 * Queue plugin configuration.
 */
export interface QueuePluginConfig {
	/** Queue adapter instance (e.g., postgresQueueAdapter) */
	adapter: QueueAdapter;

	/**
	 * Job handlers keyed by job type name.
	 * Registered at config time.
	 */
	handlers?: Record<string, JobHandler>;

	/**
	 * Worker configuration per queue name.
	 * @default { default: { concurrency: 1, pollInterval: 1000 } }
	 */
	workers?: Record<string, WorkerConfig>;

	/**
	 * Interval for recovering stalled jobs (ms).
	 * @default 30000 (30 seconds)
	 */
	stalledCheckInterval?: number;

	/**
	 * Interval for purging completed/dead jobs (ms).
	 * 0 = disabled.
	 * @default 3600000 (1 hour)
	 */
	purgeInterval?: number;

	/**
	 * Age threshold for purging completed jobs (ms).
	 * @default 604800000 (7 days)
	 */
	purgeAge?: number;

	/** Enable admin dashboard API routes. @default true */
	adminDashboard?: boolean;
}

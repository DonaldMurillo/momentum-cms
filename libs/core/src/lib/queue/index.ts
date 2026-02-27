/**
 * Queue module for Momentum CMS
 * Defines interfaces for job queue adapters
 */

// ============================================
// Status & Priority
// ============================================

/**
 * Job status lifecycle:
 * pending -> active -> completed
 *                   -> failed (retries remain) -> pending (retry)
 *                   -> dead (max retries exceeded)
 */
export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'dead';

/**
 * Job priority levels. Lower number = higher priority.
 * 0 is the highest priority, 9 is the lowest.
 */
export type JobPriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ============================================
// Backoff & Retry
// ============================================

/**
 * Backoff strategy for job retries.
 */
export interface BackoffStrategy {
	/** Backoff type */
	type: 'exponential' | 'linear' | 'fixed';
	/** Base delay in milliseconds */
	delay: number;
	/** Maximum delay in milliseconds (cap for exponential). @default 300000 (5 minutes) */
	maxDelay?: number;
}

// ============================================
// Enqueue Options
// ============================================

/**
 * Options when enqueuing a job.
 */
export interface EnqueueOptions {
	/** Queue name. @default 'default' */
	queue?: string;
	/** Priority (0=highest, 9=lowest). @default 5 */
	priority?: JobPriority;
	/** Delay execution until this Date (ISO string or Date). */
	runAt?: string | Date;
	/** Maximum retry attempts. @default 3 */
	maxRetries?: number;
	/** Backoff strategy for retries. @default { type: 'exponential', delay: 1000 } */
	backoff?: BackoffStrategy;
	/** Maximum time in ms a job can run before being considered stalled. @default 30000 */
	timeout?: number;
	/** Unique key for deduplication. If a pending/active job with this key exists, the new job is skipped. */
	uniqueKey?: string;
	/** Arbitrary metadata attached to the job (not part of the handler payload). */
	metadata?: Record<string, unknown>;
}

// ============================================
// Job Record
// ============================================

/**
 * A job record as stored/returned by the adapter.
 */
export interface Job<T = unknown> {
	/** Unique job ID */
	id: string;
	/** Job type name (matches a registered handler) */
	type: string;
	/** Job payload (serialized as JSON) */
	payload: T;
	/** Current job status */
	status: JobStatus;
	/** Queue name */
	queue: string;
	/** Priority (0-9) */
	priority: JobPriority;
	/** Number of attempts made */
	attempts: number;
	/** Maximum retry attempts */
	maxRetries: number;
	/** Backoff configuration */
	backoff: BackoffStrategy;
	/** Timeout in milliseconds */
	timeout: number;
	/** Unique deduplication key */
	uniqueKey?: string;
	/** When the job should run (null = immediately) */
	runAt: string | null;
	/** When the job was last started */
	startedAt?: string;
	/** When the job completed or failed permanently */
	finishedAt?: string;
	/** Last error message (if failed/dead) */
	lastError?: string;
	/** Arbitrary metadata */
	metadata?: Record<string, unknown>;
	/** ISO timestamp of creation */
	createdAt: string;
	/** ISO timestamp of last update */
	updatedAt: string;
}

// ============================================
// Query & Stats
// ============================================

/**
 * Options for fetching the next batch of jobs to process.
 */
export interface FetchJobsOptions {
	/** Queue name to fetch from. @default 'default' */
	queue?: string;
	/** Maximum number of jobs to fetch. @default 1 */
	limit?: number;
}

/**
 * Options for querying jobs (admin dashboard, monitoring).
 */
export interface JobQueryOptions {
	/** Filter by status */
	status?: JobStatus;
	/** Filter by queue name */
	queue?: string;
	/** Filter by job type */
	type?: string;
	/** Pagination limit. @default 50 */
	limit?: number;
	/** Pagination page (1-based). @default 1 */
	page?: number;
}

/**
 * Result of a job query.
 */
export interface JobQueryResult {
	jobs: Job[];
	total: number;
	page: number;
	limit: number;
}

/**
 * Queue statistics for monitoring.
 */
export interface QueueStats {
	/** Queue name */
	queue: string;
	/** Count of jobs by status */
	counts: Record<JobStatus, number>;
	/** Oldest pending job age in milliseconds */
	oldestPendingAge?: number;
}

// ============================================
// Queue Adapter Interface
// ============================================

/**
 * Queue adapter interface.
 * Implement this interface to create custom queue backends (PostgreSQL, Redis, etc.).
 */
export interface QueueAdapter {
	/**
	 * Initialize the queue backend (create indexes, etc.).
	 * Called once during server startup after collection tables are created.
	 */
	initialize(): Promise<void>;

	/**
	 * Enqueue a new job.
	 * @param type - Job type name (matches a registered handler)
	 * @param payload - Job payload data
	 * @param options - Enqueue options
	 * @returns The created job record
	 */
	enqueue(type: string, payload: unknown, options?: EnqueueOptions): Promise<Job>;

	/**
	 * Fetch the next batch of jobs ready for processing.
	 * Must use atomic locking (e.g., SKIP LOCKED) to prevent double-processing.
	 * Jobs are returned in priority order (lowest number first), then by runAt/createdAt.
	 */
	fetchJobs(options?: FetchJobsOptions): Promise<Job[]>;

	/**
	 * Mark a job as completed.
	 */
	completeJob(jobId: string): Promise<void>;

	/**
	 * Mark a job as failed. If retries remain, schedules the next attempt.
	 * If max retries exceeded, moves to 'dead' status.
	 */
	failJob(jobId: string, error: string): Promise<void>;

	/**
	 * Query jobs for monitoring/admin UI.
	 */
	queryJobs(options?: JobQueryOptions): Promise<JobQueryResult>;

	/**
	 * Get statistics for one or all queues.
	 * @param queue - Optional queue name (all queues if omitted)
	 */
	getStats(queue?: string): Promise<QueueStats[]>;

	/**
	 * Get a single job by ID.
	 * @returns The job record, or null if not found
	 */
	getJob(jobId: string): Promise<Job | null>;

	/**
	 * Delete a specific job by ID.
	 * @returns True if deleted
	 */
	deleteJob(jobId: string): Promise<boolean>;

	/**
	 * Purge completed/dead jobs older than the given age.
	 * @param olderThanMs - Age threshold in milliseconds
	 * @param status - Status to purge. @default 'completed'
	 * @returns Number of jobs purged
	 */
	purgeJobs(olderThanMs: number, status?: 'completed' | 'dead'): Promise<number>;

	/**
	 * Retry a dead job (move it back to pending with reset attempts).
	 * @returns The updated job
	 */
	retryJob(jobId: string): Promise<Job>;

	/**
	 * Detect and recover stalled jobs (active jobs that exceeded their timeout).
	 * Moves them back to pending for retry, or to dead if maxRetries exceeded.
	 * @returns Number of jobs recovered
	 */
	recoverStalledJobs(): Promise<number>;

	/**
	 * Graceful shutdown. Releases any held resources.
	 */
	shutdown(): Promise<void>;
}

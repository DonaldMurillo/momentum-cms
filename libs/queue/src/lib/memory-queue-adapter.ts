/**
 * In-Memory Queue Adapter
 *
 * Stores jobs in memory. Useful for development, testing, and simple deployments
 * that don't need persistence across restarts.
 *
 * Since Node.js is single-threaded, atomic locking (SKIP LOCKED) is unnecessary —
 * all operations are inherently serialized.
 */

import type {
	BackoffStrategy,
	EnqueueOptions,
	FetchJobsOptions,
	Job,
	JobQueryOptions,
	JobQueryResult,
	QueueAdapter,
	QueueStats,
} from '@momentumcms/core';

const DEFAULT_BACKOFF: BackoffStrategy = { type: 'exponential', delay: 1000 };

function generateId(): string {
	const hex = '0123456789abcdef';
	const segments = [8, 4, 4, 4, 12];
	return segments
		.map((len) => {
			let segment = '';
			for (let i = 0; i < len; i++) {
				segment += hex[Math.floor(Math.random() * 16)];
			}
			return segment;
		})
		.join('-');
}

function calculateBackoffDelay(backoff: BackoffStrategy, attempt: number): number {
	const maxDelay = backoff.maxDelay ?? 300000;
	switch (backoff.type) {
		case 'exponential':
			return Math.min(backoff.delay * Math.pow(2, attempt - 1), maxDelay);
		case 'linear':
			return Math.min(backoff.delay * attempt, maxDelay);
		case 'fixed':
		default:
			return backoff.delay;
	}
}

/**
 * In-memory queue adapter for development and testing.
 *
 * All jobs are stored in a plain array. No persistence across server restarts.
 *
 * @example
 * ```typescript
 * import { MemoryQueueAdapter } from '@momentumcms/queue';
 *
 * const queue = queuePlugin({
 *   adapter: new MemoryQueueAdapter(),
 *   handlers: { ... },
 * });
 * ```
 */
export class MemoryQueueAdapter implements QueueAdapter {
	readonly jobs: Job[] = [];

	async initialize(): Promise<void> {
		// No-op for in-memory adapter
	}

	async enqueue(type: string, payload: unknown, opts?: EnqueueOptions): Promise<Job> {
		const now = new Date().toISOString();
		const uniqueKey = opts?.uniqueKey;

		// Deduplication: if a pending/active job with the same uniqueKey exists, return it
		if (uniqueKey) {
			const existing = this.jobs.find(
				(j) => j.uniqueKey === uniqueKey && (j.status === 'pending' || j.status === 'active'),
			);
			if (existing) {
				return existing;
			}
		}

		const runAt = opts?.runAt
			? typeof opts.runAt === 'string'
				? opts.runAt
				: opts.runAt.toISOString()
			: null;

		const job: Job = {
			id: generateId(),
			type,
			payload,
			status: 'pending',
			queue: opts?.queue ?? 'default',
			priority: opts?.priority ?? 5,
			attempts: 0,
			maxRetries: opts?.maxRetries ?? 3,
			backoff: opts?.backoff ?? DEFAULT_BACKOFF,
			timeout: opts?.timeout ?? 30000,
			uniqueKey,
			runAt,
			metadata: opts?.metadata,
			createdAt: now,
			updatedAt: now,
		};

		this.jobs.push(job);
		return job;
	}

	async fetchJobs(opts?: FetchJobsOptions): Promise<Job[]> {
		const queueName = opts?.queue ?? 'default';
		const limit = opts?.limit ?? 1;
		const now = Date.now();

		// Find eligible pending jobs
		const eligible = this.jobs
			.filter(
				(j) =>
					j.queue === queueName &&
					j.status === 'pending' &&
					(j.runAt === null || new Date(j.runAt).getTime() <= now),
			)
			.sort((a, b) => {
				// Priority ASC (lower = higher priority)
				if (a.priority !== b.priority) return a.priority - b.priority;
				// runAt ASC (nulls first)
				const aRunAt = a.runAt ? new Date(a.runAt).getTime() : 0;
				const bRunAt = b.runAt ? new Date(b.runAt).getTime() : 0;
				if (aRunAt !== bRunAt) return aRunAt - bRunAt;
				// createdAt ASC
				return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			})
			.slice(0, limit);

		// Atomically claim them
		const nowISO = new Date().toISOString();
		for (const job of eligible) {
			job.status = 'active';
			job.startedAt = nowISO;
			job.attempts += 1;
			job.updatedAt = nowISO;
		}

		return eligible;
	}

	async completeJob(jobId: string): Promise<void> {
		const job = this.jobs.find((j) => j.id === jobId && j.status === 'active');
		if (!job) return;

		const now = new Date().toISOString();
		job.status = 'completed';
		job.finishedAt = now;
		job.updatedAt = now;
	}

	async failJob(jobId: string, error: string): Promise<void> {
		const job = this.jobs.find((j) => j.id === jobId && j.status === 'active');
		if (!job) return;

		const now = new Date().toISOString();
		job.lastError = error;
		job.updatedAt = now;

		if (job.attempts >= job.maxRetries) {
			job.status = 'dead';
			job.finishedAt = now;
		} else {
			const delay = calculateBackoffDelay(job.backoff, job.attempts);
			job.status = 'pending';
			job.runAt = new Date(Date.now() + delay).toISOString();
		}
	}

	async queryJobs(opts?: JobQueryOptions): Promise<JobQueryResult> {
		const limit = opts?.limit ?? 50;
		const page = opts?.page ?? 1;

		let filtered = [...this.jobs];

		if (opts?.status) {
			filtered = filtered.filter((j) => j.status === opts.status);
		}
		if (opts?.queue) {
			filtered = filtered.filter((j) => j.queue === opts.queue);
		}
		if (opts?.type) {
			filtered = filtered.filter((j) => j.type === opts.type);
		}

		// Sort by createdAt DESC (newest first) for admin UI
		filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		const total = filtered.length;
		const start = (page - 1) * limit;
		const jobs = filtered.slice(start, start + limit);

		return { jobs, total, page, limit };
	}

	async getStats(queueName?: string): Promise<QueueStats[]> {
		const filtered = queueName ? this.jobs.filter((j) => j.queue === queueName) : this.jobs;

		const statsMap = new Map<string, QueueStats>();

		for (const job of filtered) {
			if (!statsMap.has(job.queue)) {
				statsMap.set(job.queue, {
					queue: job.queue,
					counts: { pending: 0, active: 0, completed: 0, failed: 0, dead: 0 },
				});
			}
			const stats = statsMap.get(job.queue);
			if (stats) {
				stats.counts[job.status]++;
			}
		}

		// Calculate oldest pending age
		const now = Date.now();
		for (const stats of statsMap.values()) {
			if (stats.counts.pending > 0) {
				const pendingJobs = filtered.filter(
					(j) => j.queue === stats.queue && j.status === 'pending',
				);
				const oldest = Math.min(...pendingJobs.map((j) => new Date(j.createdAt).getTime()));
				stats.oldestPendingAge = now - oldest;
			}
		}

		return Array.from(statsMap.values());
	}

	async getJob(jobId: string): Promise<Job | null> {
		return this.jobs.find((j) => j.id === jobId) ?? null;
	}

	async deleteJob(jobId: string): Promise<boolean> {
		const idx = this.jobs.findIndex((j) => j.id === jobId);
		if (idx === -1) return false;
		this.jobs.splice(idx, 1);
		return true;
	}

	async purgeJobs(
		olderThanMs: number,
		status: 'completed' | 'dead' = 'completed',
	): Promise<number> {
		const threshold = Date.now() - olderThanMs;
		let purged = 0;

		for (let i = this.jobs.length - 1; i >= 0; i--) {
			const job = this.jobs[i];
			if (
				job.status === status &&
				job.finishedAt &&
				new Date(job.finishedAt).getTime() < threshold
			) {
				this.jobs.splice(i, 1);
				purged++;
			}
		}

		return purged;
	}

	async retryJob(jobId: string): Promise<Job> {
		const job = this.jobs.find((j) => j.id === jobId && j.status === 'dead');
		if (!job) {
			throw new Error(`Job ${jobId} not found or not in dead status`);
		}

		const now = new Date().toISOString();
		job.status = 'pending';
		job.attempts = 0;
		job.lastError = undefined;
		job.finishedAt = undefined;
		job.startedAt = undefined;
		job.runAt = null;
		job.updatedAt = now;

		return job;
	}

	async recoverStalledJobs(): Promise<number> {
		const now = Date.now();
		let recovered = 0;

		for (const job of this.jobs) {
			if (
				job.status === 'active' &&
				job.startedAt &&
				new Date(job.startedAt).getTime() + job.timeout < now
			) {
				job.lastError = 'Job stalled (timeout exceeded)';
				job.updatedAt = new Date().toISOString();

				if (job.attempts >= job.maxRetries) {
					job.status = 'dead';
					job.finishedAt = new Date().toISOString();
				} else {
					job.status = 'pending';
					job.runAt = new Date().toISOString();
					job.finishedAt = undefined;
				}

				recovered++;
			}
		}

		return recovered;
	}

	async shutdown(): Promise<void> {
		// No-op for in-memory adapter
	}
}

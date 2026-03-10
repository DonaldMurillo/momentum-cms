import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryQueueAdapter } from '../lib/memory-queue-adapter';

describe('MemoryQueueAdapter', () => {
	let adapter: MemoryQueueAdapter;

	beforeEach(() => {
		adapter = new MemoryQueueAdapter();
	});

	describe('initialize', () => {
		it('should initialize without error', async () => {
			await expect(adapter.initialize()).resolves.toBeUndefined();
		});
	});

	describe('enqueue', () => {
		it('should create a job with defaults', async () => {
			const before = Date.now();
			const job = await adapter.enqueue('test-type', { key: 'value' });

			expect(job.id).toBeTruthy();
			expect(job.type).toBe('test-type');
			expect(job.payload).toEqual({ key: 'value' });
			expect(job.status).toBe('pending');
			expect(job.queue).toBe('default');
			expect(job.priority).toBe(5);
			expect(job.attempts).toBe(0);
			expect(job.maxRetries).toBe(3);
			expect(job.timeout).toBe(30000);
			expect(job.backoff).toEqual({ type: 'exponential', delay: 1000 });
			expect(job.runAt).toBeNull();
			expect(new Date(job.createdAt).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(job.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
			expect(adapter.jobs).toHaveLength(1);
		});

		it('should respect enqueue options', async () => {
			const job = await adapter.enqueue(
				'send-email',
				{ to: 'a@b.com' },
				{
					queue: 'emails',
					priority: 1,
					maxRetries: 5,
					timeout: 60000,
					uniqueKey: 'email-1',
					metadata: { source: 'cron' },
				},
			);

			expect(job.queue).toBe('emails');
			expect(job.priority).toBe(1);
			expect(job.maxRetries).toBe(5);
			expect(job.timeout).toBe(60000);
			expect(job.uniqueKey).toBe('email-1');
			expect(job.metadata).toEqual({ source: 'cron' });
		});

		it('should deduplicate by uniqueKey for pending jobs', async () => {
			const job1 = await adapter.enqueue('test', {}, { uniqueKey: 'dup-key' });
			const job2 = await adapter.enqueue('test', {}, { uniqueKey: 'dup-key' });

			expect(job1.id).toBe(job2.id);
			expect(adapter.jobs).toHaveLength(1);
		});

		it('should allow same uniqueKey after job completes', async () => {
			const job1 = await adapter.enqueue('test', {}, { uniqueKey: 'dup-key' });
			const fetched = await adapter.fetchJobs();
			await adapter.completeJob(fetched[0].id);

			const job2 = await adapter.enqueue('test', {}, { uniqueKey: 'dup-key' });
			expect(job2.id).not.toBe(job1.id);
			expect(adapter.jobs).toHaveLength(2);
		});

		it('should handle runAt as Date', async () => {
			const future = new Date(Date.now() + 60000);
			const job = await adapter.enqueue('test', {}, { runAt: future });
			expect(job.runAt).toBe(future.toISOString());
		});

		it('should handle runAt as string', async () => {
			const iso = '2030-01-01T00:00:00.000Z';
			const job = await adapter.enqueue('test', {}, { runAt: iso });
			expect(job.runAt).toBe(iso);
		});
	});

	describe('fetchJobs', () => {
		it('should fetch and claim pending jobs, leaving others untouched', async () => {
			await adapter.enqueue('test', { n: 1 });
			await adapter.enqueue('test', { n: 2 });

			const jobs = await adapter.fetchJobs({ limit: 1 });
			expect(jobs).toHaveLength(1);
			expect(jobs[0].status).toBe('active');
			expect(jobs[0].attempts).toBe(1);
			expect(jobs[0].startedAt).toBeTruthy();

			// Second job should remain pending and untouched
			const remaining = adapter.jobs.find((j) => j.id !== jobs[0].id);
			expect(remaining?.status).toBe('pending');
			expect(remaining?.attempts).toBe(0);
		});

		it('should fetch exactly 1 job by default (no options)', async () => {
			await adapter.enqueue('a', {});
			await adapter.enqueue('b', {});

			const jobs = await adapter.fetchJobs();
			expect(jobs).toHaveLength(1);
		});

		it('should not fetch jobs scheduled for the future', async () => {
			await adapter.enqueue('test', {}, { runAt: new Date(Date.now() + 60000) });
			const jobs = await adapter.fetchJobs();
			expect(jobs).toHaveLength(0);
		});

		it('should order by priority (lower = higher priority)', async () => {
			await adapter.enqueue('low', {}, { priority: 9 });
			await adapter.enqueue('high', {}, { priority: 1 });
			await adapter.enqueue('mid', {}, { priority: 5 });

			const jobs = await adapter.fetchJobs({ limit: 3 });
			expect(jobs.map((j) => j.type)).toEqual(['high', 'mid', 'low']);
		});

		it('should only fetch from the specified queue', async () => {
			await adapter.enqueue('a', {}, { queue: 'q1' });
			await adapter.enqueue('b', {}, { queue: 'q2' });

			const jobs = await adapter.fetchJobs({ queue: 'q1' });
			expect(jobs).toHaveLength(1);
			expect(jobs[0].type).toBe('a');
		});
	});

	describe('completeJob', () => {
		it('should mark an active job as completed', async () => {
			await adapter.enqueue('test', {});
			const [job] = await adapter.fetchJobs();
			await adapter.completeJob(job.id);

			const completed = await adapter.getJob(job.id);
			expect(completed?.status).toBe('completed');
			expect(completed?.finishedAt).toBeTruthy();
		});

		it('should no-op for non-active jobs', async () => {
			const job = await adapter.enqueue('test', {});
			await adapter.completeJob(job.id); // still pending, not active
			expect((await adapter.getJob(job.id))?.status).toBe('pending');
		});
	});

	describe('failJob', () => {
		it('should retry with exponential backoff when retries remain', async () => {
			const before = Date.now();
			await adapter.enqueue(
				'test',
				{},
				{
					maxRetries: 3,
					backoff: { type: 'exponential', delay: 1000 },
				},
			);
			const [job] = await adapter.fetchJobs(); // attempts = 1
			await adapter.failJob(job.id, 'connection timeout');

			const failed = await adapter.getJob(job.id);
			expect(failed).not.toBeNull();
			expect(failed?.status).toBe('pending');
			expect(failed?.lastError).toBe('connection timeout');
			// Exponential backoff: delay * 2^(attempt-1) = 1000 * 2^0 = 1000ms
			expect(failed?.runAt).toBeTruthy();
			const runAtTime = new Date(String(failed?.runAt)).getTime();
			expect(runAtTime).toBeGreaterThanOrEqual(before + 900); // ~1000ms in future (with margin)
			expect(runAtTime).toBeLessThanOrEqual(before + 2000);
		});

		it('should use linear backoff correctly', async () => {
			const before = Date.now();
			await adapter.enqueue(
				'test',
				{},
				{
					maxRetries: 3,
					backoff: { type: 'linear', delay: 500 },
				},
			);
			const [job] = await adapter.fetchJobs(); // attempts = 1
			await adapter.failJob(job.id, 'timeout');

			const failed = await adapter.getJob(job.id);
			expect(failed).not.toBeNull();
			// Linear backoff: delay * attempt = 500 * 1 = 500ms
			expect(failed?.runAt).toBeTruthy();
			const runAtTime = new Date(String(failed?.runAt)).getTime();
			expect(runAtTime).toBeGreaterThanOrEqual(before + 400);
			expect(runAtTime).toBeLessThanOrEqual(before + 1000);
		});

		it('should use fixed backoff correctly', async () => {
			const before = Date.now();
			await adapter.enqueue(
				'test',
				{},
				{
					maxRetries: 3,
					backoff: { type: 'fixed', delay: 2000 },
				},
			);
			const [job] = await adapter.fetchJobs(); // attempts = 1
			await adapter.failJob(job.id, 'timeout');

			const failed = await adapter.getJob(job.id);
			expect(failed).not.toBeNull();
			// Fixed backoff: always 2000ms
			expect(failed?.runAt).toBeTruthy();
			const runAtTime = new Date(String(failed?.runAt)).getTime();
			expect(runAtTime).toBeGreaterThanOrEqual(before + 1900);
			expect(runAtTime).toBeLessThanOrEqual(before + 3000);
		});

		it('should move to dead when max retries exceeded', async () => {
			await adapter.enqueue('test', {}, { maxRetries: 1 });
			const [job] = await adapter.fetchJobs(); // attempts = 1
			await adapter.failJob(job.id, 'fatal error');

			const dead = await adapter.getJob(job.id);
			expect(dead?.status).toBe('dead');
			expect(dead?.finishedAt).toBeTruthy();
			expect(dead?.lastError).toBe('fatal error');
		});

		it('should no-op for non-active jobs', async () => {
			const job = await adapter.enqueue('test', {});
			await adapter.failJob(job.id, 'error'); // still pending, not active
			expect((await adapter.getJob(job.id))?.status).toBe('pending');
			expect((await adapter.getJob(job.id))?.lastError).toBeUndefined();
		});
	});

	describe('queryJobs', () => {
		it('should return paginated results', async () => {
			for (let i = 0; i < 5; i++) {
				await adapter.enqueue('test', { i });
			}

			const page1 = await adapter.queryJobs({ limit: 2, page: 1 });
			expect(page1.jobs).toHaveLength(2);
			expect(page1.total).toBe(5);
			expect(page1.page).toBe(1);
			expect(page1.limit).toBe(2);

			const page2 = await adapter.queryJobs({ limit: 2, page: 2 });
			expect(page2.jobs).toHaveLength(2);
			expect(page2.page).toBe(2);
			// Page 2 should have different jobs than page 1
			const page1Ids = new Set(page1.jobs.map((j) => j.id));
			expect(page2.jobs.every((j) => !page1Ids.has(j.id))).toBe(true);
		});

		it('should filter by status', async () => {
			await adapter.enqueue('test', {});
			await adapter.enqueue('test', {});
			const [job] = await adapter.fetchJobs();
			await adapter.completeJob(job.id);

			const result = await adapter.queryJobs({ status: 'completed' });
			expect(result.total).toBe(1);
		});

		it('should filter by queue', async () => {
			await adapter.enqueue('test', {}, { queue: 'q1' });
			await adapter.enqueue('test', {}, { queue: 'q2' });

			const result = await adapter.queryJobs({ queue: 'q1' });
			expect(result.total).toBe(1);
		});

		it('should filter by type', async () => {
			await adapter.enqueue('send-email', {});
			await adapter.enqueue('process-image', {});
			await adapter.enqueue('send-email', {});

			const result = await adapter.queryJobs({ type: 'send-email' });
			expect(result.total).toBe(2);
			expect(result.jobs.every((j) => j.type === 'send-email')).toBe(true);
		});
	});

	describe('getStats', () => {
		it('should return counts grouped by queue and status', async () => {
			await adapter.enqueue('a', {}, { queue: 'q1' });
			await adapter.enqueue('b', {}, { queue: 'q1' });
			await adapter.enqueue('c', {}, { queue: 'q2' });
			const [job] = await adapter.fetchJobs({ queue: 'q1' });
			await adapter.completeJob(job.id);

			const stats = await adapter.getStats();
			expect(stats).toHaveLength(2);

			const q1 = stats.find((s) => s.queue === 'q1');
			expect(q1?.counts.pending).toBe(1);
			expect(q1?.counts.completed).toBe(1);
			expect(q1?.counts.active).toBe(0);
			expect(q1?.counts.dead).toBe(0);
			expect(q1?.oldestPendingAge).toBeGreaterThanOrEqual(0);

			const q2 = stats.find((s) => s.queue === 'q2');
			expect(q2?.counts.pending).toBe(1);
			expect(q2?.counts.completed).toBe(0);
		});

		it('should filter by queue name', async () => {
			await adapter.enqueue('a', {}, { queue: 'q1' });
			await adapter.enqueue('b', {}, { queue: 'q2' });

			const stats = await adapter.getStats('q1');
			expect(stats).toHaveLength(1);
			expect(stats[0].queue).toBe('q1');
		});
	});

	describe('getJob', () => {
		it('should return null for non-existent job', async () => {
			expect(await adapter.getJob('nonexistent-id')).toBeNull();
		});
	});

	describe('deleteJob', () => {
		it('should delete and return true', async () => {
			const job = await adapter.enqueue('test', {});
			expect(await adapter.deleteJob(job.id)).toBe(true);
			expect(adapter.jobs).toHaveLength(0);
		});

		it('should return false for non-existent job', async () => {
			expect(await adapter.deleteJob('fake-id')).toBe(false);
		});
	});

	describe('purgeJobs', () => {
		it('should purge completed jobs older than threshold', async () => {
			await adapter.enqueue('test', {});
			const [job] = await adapter.fetchJobs();
			await adapter.completeJob(job.id);

			// Artificially age the finishedAt
			const completed = adapter.jobs.find((j) => j.id === job.id);
			expect(completed).toBeDefined();
			if (completed) completed.finishedAt = new Date(Date.now() - 100000).toISOString();

			const purged = await adapter.purgeJobs(50000, 'completed');
			expect(purged).toBe(1);
			expect(adapter.jobs).toHaveLength(0);
		});

		it('should purge dead jobs when status is dead', async () => {
			await adapter.enqueue('test', {}, { maxRetries: 1 });
			const [job] = await adapter.fetchJobs();
			await adapter.failJob(job.id, 'fatal');

			const dead = adapter.jobs.find((j) => j.id === job.id);
			expect(dead).toBeDefined();
			if (dead) dead.finishedAt = new Date(Date.now() - 100000).toISOString();

			const purged = await adapter.purgeJobs(50000, 'dead');
			expect(purged).toBe(1);
			expect(adapter.jobs).toHaveLength(0);
		});

		it('should not purge recent jobs', async () => {
			await adapter.enqueue('test', {});
			const [job] = await adapter.fetchJobs();
			await adapter.completeJob(job.id);

			const purged = await adapter.purgeJobs(999999999, 'completed');
			expect(purged).toBe(0);
		});
	});

	describe('retryJob', () => {
		it('should reset a dead job back to pending', async () => {
			await adapter.enqueue('test', {}, { maxRetries: 1 });
			const [job] = await adapter.fetchJobs();
			await adapter.failJob(job.id, 'error');

			const retried = await adapter.retryJob(job.id);
			expect(retried.status).toBe('pending');
			expect(retried.attempts).toBe(0);
			expect(retried.lastError).toBeUndefined();
			expect(retried.runAt).toBeNull();
			expect(retried.startedAt).toBeUndefined();
			expect(retried.finishedAt).toBeUndefined();
		});

		it('should throw for non-dead jobs', async () => {
			const job = await adapter.enqueue('test', {});
			await expect(adapter.retryJob(job.id)).rejects.toThrow('not in dead status');
		});

		it('should throw for non-existent jobs', async () => {
			await expect(adapter.retryJob('nonexistent')).rejects.toThrow(
				'not found or not in dead status',
			);
		});
	});

	describe('recoverStalledJobs', () => {
		it('should recover stalled active jobs with runAt and preserved attempts', async () => {
			await adapter.enqueue('test', {}, { timeout: 100, maxRetries: 3 });
			const [job] = await adapter.fetchJobs();

			// Artificially stall the job
			const active = adapter.jobs.find((j) => j.id === job.id);
			expect(active).toBeDefined();
			if (active) active.startedAt = new Date(Date.now() - 200).toISOString();

			const recovered = await adapter.recoverStalledJobs();
			expect(recovered).toBe(1);

			const updated = await adapter.getJob(job.id);
			expect(updated?.status).toBe('pending');
			expect(updated?.lastError).toBe('Job stalled (timeout exceeded)');
			expect(updated?.runAt).toBeTruthy(); // should be set for re-fetch
			expect(updated?.attempts).toBe(1); // preserved, not reset
		});

		it('should move to dead if max retries exceeded', async () => {
			await adapter.enqueue('test', {}, { timeout: 100, maxRetries: 1 });
			const [job] = await adapter.fetchJobs(); // attempts = 1

			const active = adapter.jobs.find((j) => j.id === job.id);
			expect(active).toBeDefined();
			if (active) active.startedAt = new Date(Date.now() - 200).toISOString();

			await adapter.recoverStalledJobs();

			const updated = await adapter.getJob(job.id);
			expect(updated?.status).toBe('dead');
			expect(updated?.finishedAt).toBeTruthy();
		});

		it('should return 0 when no jobs are stalled', async () => {
			await adapter.enqueue('test', {});
			const recovered = await adapter.recoverStalledJobs();
			expect(recovered).toBe(0);
		});
	});

	describe('shutdown', () => {
		it('should shutdown without error', async () => {
			await expect(adapter.shutdown()).resolves.toBeUndefined();
		});
	});
});

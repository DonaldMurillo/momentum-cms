import { postgresQueueAdapter } from '../lib/postgres-queue-adapter';
import type { QueueAdapter } from '@momentumcms/core';

/**
 * Unit tests for the PostgreSQL queue adapter.
 * Uses a mock pool to test SQL generation and adapter logic
 * without requiring a real PostgreSQL connection.
 */

interface QueryRecord {
	text: string;
	values: unknown[];
}

function createMockPool(): {
	pool: {
		query: ReturnType<typeof vi.fn>;
	};
	getLastQuery: () => QueryRecord;
	getQueries: () => QueryRecord[];
	/** Queue a return value for the next pool.query call. */
	queueResult: (result: { rows: Record<string, unknown>[]; rowCount?: number }) => void;
} {
	const queries: QueryRecord[] = [];
	const resultQueue: Array<{ rows: Record<string, unknown>[]; rowCount?: number }> = [];

	const pool = {
		query: vi.fn(async (text: string, values?: unknown[]) => {
			queries.push({ text, values: values ?? [] });
			const result = resultQueue.shift();
			return result ?? { rows: [], rowCount: 0 };
		}),
	};

	return {
		pool,
		getLastQuery: () => queries[queries.length - 1] ?? { text: '', values: [] },
		getQueries: () => queries,
		queueResult: (result) => resultQueue.push(result),
	};
}

describe('postgresQueueAdapter', () => {
	let adapter: QueueAdapter;
	let mock: ReturnType<typeof createMockPool>;

	beforeEach(() => {
		mock = createMockPool();
		adapter = postgresQueueAdapter({ pool: mock.pool });
	});

	describe('tableName validation', () => {
		it('should accept valid table names', () => {
			expect(() =>
				postgresQueueAdapter({ pool: mock.pool, tableName: 'queue-jobs' }),
			).not.toThrow();
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: 'my_queue' })).not.toThrow();
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: '_private' })).not.toThrow();
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: 'Jobs123' })).not.toThrow();
		});

		it('should reject table names with SQL injection characters', () => {
			expect(() =>
				postgresQueueAdapter({ pool: mock.pool, tableName: 'jobs"; DROP TABLE users; --' }),
			).toThrow('Invalid table name');
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: "jobs'; --" })).toThrow(
				'Invalid table name',
			);
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: 'jobs spaces' })).toThrow(
				'Invalid table name',
			);
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: '' })).toThrow(
				'Invalid table name',
			);
			expect(() => postgresQueueAdapter({ pool: mock.pool, tableName: '123queue' })).toThrow(
				'Invalid table name',
			);
		});
	});

	describe('initialize', () => {
		it('should create partial unique index for deduplication', async () => {
			await adapter.initialize();

			const query = mock.getLastQuery();
			expect(query.text).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
			expect(query.text).toContain('idx_queue_jobs_unique_key');
		});
	});

	describe('enqueue', () => {
		it('should insert a job with default options', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'test-id',
						type: 'email:send',
						payload: { to: 'test@test.com' },
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						uniqueKey: null,
						runAt: null,
						startedAt: null,
						finishedAt: null,
						lastError: null,
						metadata: null,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.enqueue('email:send', { to: 'test@test.com' });

			// Verify the returned job maps correctly
			expect(job.type).toBe('email:send');
			expect(job.payload).toEqual({ to: 'test@test.com' });
			expect(job.status).toBe('pending');

			// Verify the actual SQL parameters sent to the database include correct defaults
			const query = mock.getLastQuery();
			expect(query.text).toContain('INSERT INTO');
			// values: [id, type, payload, queue, priority, maxRetries, backoff, timeout, uniqueKey, runAt, metadata, now]
			expect(query.values[1]).toBe('email:send'); // type
			expect(query.values[2]).toBe(JSON.stringify({ to: 'test@test.com' })); // payload
			expect(query.values[3]).toBe('default'); // queue default
			expect(query.values[4]).toBe(5); // priority default
			expect(query.values[5]).toBe(3); // maxRetries default
			expect(query.values[6]).toBe(JSON.stringify({ type: 'exponential', delay: 1000 })); // backoff default
			expect(query.values[7]).toBe(30000); // timeout default
			expect(query.values[8]).toBeNull(); // uniqueKey null
			expect(query.values[9]).toBeNull(); // runAt null
			expect(query.values[10]).toBeNull(); // metadata null
		});

		it('should pass custom options to the insert query', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'test-id',
						type: 'webhook:deliver',
						payload: {},
						status: 'pending',
						queue: 'webhooks',
						priority: 2,
						attempts: 0,
						maxRetries: 5,
						backoff: { type: 'linear', delay: 2000 },
						timeout: 60000,
						uniqueKey: 'hook-123',
						runAt: null,
						startedAt: null,
						finishedAt: null,
						lastError: null,
						metadata: { source: 'test' },
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.enqueue(
				'webhook:deliver',
				{},
				{
					queue: 'webhooks',
					priority: 2,
					maxRetries: 5,
					backoff: { type: 'linear', delay: 2000 },
					timeout: 60000,
					uniqueKey: 'hook-123',
					metadata: { source: 'test' },
				},
			);

			// Verify mapped result
			expect(job.queue).toBe('webhooks');
			expect(job.priority).toBe(2);
			expect(job.maxRetries).toBe(5);
			expect(job.uniqueKey).toBe('hook-123');

			// Verify the actual SQL parameters sent — custom options are passed correctly
			const query = mock.getLastQuery();
			expect(query.values[1]).toBe('webhook:deliver'); // type
			expect(query.values[3]).toBe('webhooks'); // queue
			expect(query.values[4]).toBe(2); // priority
			expect(query.values[5]).toBe(5); // maxRetries
			expect(query.values[6]).toBe(JSON.stringify({ type: 'linear', delay: 2000 })); // backoff
			expect(query.values[7]).toBe(60000); // timeout
			expect(query.values[8]).toBe('hook-123'); // uniqueKey
			expect(query.values[10]).toBe(JSON.stringify({ source: 'test' })); // metadata
		});
	});

	describe('enqueue conflict targeting', () => {
		it('should NOT use ON CONFLICT when uniqueKey is not provided', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'test-id',
						type: 'email:send',
						payload: {},
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						uniqueKey: null,
						runAt: null,
						startedAt: null,
						finishedAt: null,
						lastError: null,
						metadata: null,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			await adapter.enqueue('email:send', {});

			const query = mock.getLastQuery();
			expect(query.text).toContain('INSERT INTO');
			expect(query.text).not.toContain('ON CONFLICT');
		});

		it('should use targeted ON CONFLICT on uniqueKey partial index when uniqueKey is provided', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'test-id',
						type: 'email:send',
						payload: {},
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						uniqueKey: 'dedup-123',
						runAt: null,
						startedAt: null,
						finishedAt: null,
						lastError: null,
						metadata: null,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			await adapter.enqueue('email:send', {}, { uniqueKey: 'dedup-123' });

			const query = mock.getLastQuery();
			expect(query.text).toContain('INSERT INTO');
			expect(query.text).toContain('ON CONFLICT');
			// Must target the specific partial index, not bare DO NOTHING
			expect(query.text).toContain('"uniqueKey"');
			expect(query.text).toContain("'pending'");
			expect(query.text).toContain("'active'");
			expect(query.text).not.toMatch(/ON CONFLICT\s+DO NOTHING/);
		});
	});

	describe('fetchJobs', () => {
		it('should use SKIP LOCKED in the query', async () => {
			await adapter.fetchJobs({ queue: 'default', limit: 5 });

			const query = mock.getLastQuery();
			expect(query.text).toContain('FOR UPDATE SKIP LOCKED');
			expect(query.text).toContain('"status" = \'pending\'');
			expect(query.values).toEqual(['default', 5]);
		});

		it('should use default queue and limit when not specified', async () => {
			await adapter.fetchJobs();

			const query = mock.getLastQuery();
			expect(query.values).toEqual(['default', 1]);
		});
	});

	describe('completeJob', () => {
		it('should set status to completed with finishedAt', async () => {
			await adapter.completeJob('job-123');

			const query = mock.getLastQuery();
			expect(query.text).toContain("'completed'");
			expect(query.text).toContain('"finishedAt"');
			expect(query.values).toEqual(['job-123']);
		});

		it('should only complete jobs in active status (status guard)', async () => {
			await adapter.completeJob('job-123');

			const query = mock.getLastQuery();
			// Must include status guard to prevent completing already-recovered jobs
			expect(query.text).toContain('"status" = \'active\'');
		});
	});

	describe('failJob', () => {
		it('should move to dead when max retries exceeded', async () => {
			// First query: fetch job info
			mock.queueResult({
				rows: [
					{
						attempts: 3,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
					},
				],
			});

			await adapter.failJob('job-123', 'Some error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			expect(updateQuery.text).toContain("'dead'");
			expect(updateQuery.values[0]).toBe('Some error');
		});

		it('should reschedule with backoff when retries remain', async () => {
			// First query: fetch job info
			mock.queueResult({
				rows: [
					{
						attempts: 1,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
					},
				],
			});

			await adapter.failJob('job-123', 'Temporary error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			expect(updateQuery.text).toContain("'pending'");
			expect(updateQuery.text).toContain('"runAt"');
		});
	});

	describe('queryJobs', () => {
		it('should support filtering by status, queue, and type', async () => {
			// Count query
			mock.queueResult({ rows: [{ count: '5' }] });
			// Data query
			mock.queueResult({ rows: [] });

			await adapter.queryJobs({ status: 'failed', queue: 'email', type: 'email:send' });

			const queries = mock.getQueries();
			const countQuery = queries[0] ?? { text: '', values: [] };
			expect(countQuery.text).toContain('"status" = $1');
			expect(countQuery.text).toContain('"queue" = $2');
			expect(countQuery.text).toContain('"type" = $3');
		});

		it('should use default pagination', async () => {
			mock.queueResult({ rows: [{ count: '0' }] });
			mock.queueResult({ rows: [] });

			const result = await adapter.queryJobs();

			expect(result.page).toBe(1);
			expect(result.limit).toBe(50);
		});
	});

	describe('getStats', () => {
		it('should group counts by queue and status', async () => {
			// Main stats query
			mock.queueResult({
				rows: [
					{ queue: 'default', status: 'pending', count: '10' },
					{ queue: 'default', status: 'active', count: '2' },
					{ queue: 'default', status: 'completed', count: '100' },
					{ queue: 'email', status: 'pending', count: '5' },
				],
			});
			// Oldest pending for 'default'
			mock.queueResult({ rows: [{ age_ms: '60000' }] });
			// Oldest pending for 'email'
			mock.queueResult({ rows: [{ age_ms: '30000' }] });

			const stats = await adapter.getStats();

			expect(stats).toHaveLength(2);
			const defaultStats = stats[0];
			const emailStats = stats[1];
			expect(defaultStats?.queue).toBe('default');
			expect(defaultStats?.counts.pending).toBe(10);
			expect(defaultStats?.counts.active).toBe(2);
			expect(defaultStats?.counts.completed).toBe(100);
			expect(defaultStats?.oldestPendingAge).toBe(60000);
			expect(emailStats?.queue).toBe('email');
			expect(emailStats?.counts.pending).toBe(5);
		});
	});

	describe('retryJob', () => {
		it('should reset a dead job to pending', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'job-123',
						type: 'test',
						payload: {},
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.retryJob('job-123');

			expect(job.status).toBe('pending');
			expect(job.attempts).toBe(0);
			const query = mock.getLastQuery();
			expect(query.text).toContain('"status" = \'dead\'');
		});

		it('should throw if job not found or not dead', async () => {
			await expect(adapter.retryJob('missing')).rejects.toThrow(
				'Job missing not found or not in dead status',
			);
		});
	});

	describe('recoverStalledJobs', () => {
		it('should use timeout interval for stale detection', async () => {
			mock.queueResult({ rows: [], rowCount: 3 });

			const count = await adapter.recoverStalledJobs();

			const query = mock.getLastQuery();
			expect(query.text).toContain("'active'");
			expect(query.text).toContain('timeout');
			expect(query.text).toContain('interval');
			expect(count).toBe(3);
		});

		it('should use FOR UPDATE SKIP LOCKED to prevent concurrent recovery races', async () => {
			mock.queueResult({ rows: [], rowCount: 0 });

			await adapter.recoverStalledJobs();

			const query = mock.getLastQuery();
			// Must use a CTE or subselect with row locking to prevent
			// two concurrent recovery calls from acting on the same job
			expect(query.text).toContain('FOR UPDATE SKIP LOCKED');
		});
	});

	describe('getJob', () => {
		it('should return a job by ID when found', async () => {
			mock.queueResult({
				rows: [
					{
						id: 'job-abc',
						type: 'test',
						payload: { key: 'val' },
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.getJob('job-abc');

			expect(job).not.toBeNull();
			expect(job?.id).toBe('job-abc');
			expect(job?.type).toBe('test');
			expect(job?.payload).toEqual({ key: 'val' });
			const query = mock.getLastQuery();
			expect(query.text).toContain('"id" = $1');
			expect(query.values).toEqual(['job-abc']);
		});

		it('should return null when job not found', async () => {
			mock.queueResult({ rows: [] });

			const job = await adapter.getJob('nonexistent');

			expect(job).toBeNull();
		});
	});

	describe('deleteJob', () => {
		it('should delete a job and return true when found', async () => {
			mock.queueResult({ rows: [], rowCount: 1 });

			const result = await adapter.deleteJob('job-456');

			const query = mock.getLastQuery();
			expect(query.text).toContain('DELETE FROM');
			expect(query.values).toEqual(['job-456']);
			expect(result).toBe(true);
		});

		it('should return false when job not found', async () => {
			mock.queueResult({ rows: [], rowCount: 0 });

			const result = await adapter.deleteJob('nonexistent');

			expect(result).toBe(false);
		});
	});

	describe('purgeJobs', () => {
		it('should delete old completed jobs', async () => {
			mock.queueResult({ rows: [], rowCount: 42 });

			const count = await adapter.purgeJobs(7 * 24 * 60 * 60 * 1000);

			const query = mock.getLastQuery();
			expect(query.text).toContain('"status" = $1');
			expect(query.text).toContain('"finishedAt" < $2');
			expect(query.values[0]).toBe('completed');
			expect(count).toBe(42);
		});

		it('should support purging dead jobs', async () => {
			mock.queueResult({ rows: [], rowCount: 5 });

			await adapter.purgeJobs(86400000, 'dead');

			const query = mock.getLastQuery();
			expect(query.values[0]).toBe('dead');
		});
	});

	describe('enqueue deduplication', () => {
		it('should return existing job when uniqueKey conflicts', async () => {
			// INSERT returns empty (conflict skipped)
			mock.queueResult({ rows: [] });
			// SELECT for existing job
			mock.queueResult({
				rows: [
					{
						id: 'existing-id',
						type: 'email:send',
						payload: { to: 'test@test.com' },
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						uniqueKey: 'dedup-key',
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.enqueue(
				'email:send',
				{ to: 'test@test.com' },
				{
					uniqueKey: 'dedup-key',
				},
			);

			expect(job.id).toBe('existing-id');
			expect(job.uniqueKey).toBe('dedup-key');

			// Verify: first query was INSERT, second was SELECT for existing
			const queries = mock.getQueries();
			expect(queries[0]?.text).toContain('INSERT INTO');
			expect(queries[0]?.text).toContain('ON CONFLICT');
			expect(queries[1]?.text).toContain('SELECT');
			expect(queries[1]?.text).toContain('"uniqueKey"');
		});

		it('should retry insert when existing job was completed between insert and select', async () => {
			// INSERT returns empty (conflict)
			mock.queueResult({ rows: [] });
			// SELECT returns empty (job completed/removed between insert and select)
			mock.queueResult({ rows: [] });
			// Retry INSERT succeeds
			mock.queueResult({
				rows: [
					{
						id: 'retry-id',
						type: 'email:send',
						payload: {},
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.enqueue('email:send', {}, { uniqueKey: 'race-key' });

			expect(job.id).toBe('retry-id');
			expect(mock.getQueries()).toHaveLength(3); // INSERT, SELECT, retry INSERT

			// Verify retry INSERT also uses ON CONFLICT for safety
			const retryQuery = mock.getQueries()[2];
			expect(retryQuery?.text).toContain('ON CONFLICT');
			expect(retryQuery?.text).toContain('"uniqueKey"');
		});

		it('should return existing job when retry insert hits concurrent conflict', async () => {
			// INSERT returns empty (conflict)
			mock.queueResult({ rows: [] });
			// SELECT returns empty (job completed between insert and select)
			mock.queueResult({ rows: [] });
			// Retry INSERT also returns empty (another concurrent enqueue won)
			mock.queueResult({ rows: [] });
			// Final SELECT finds the concurrent winner
			mock.queueResult({
				rows: [
					{
						id: 'winner-id',
						type: 'email:send',
						payload: {},
						status: 'pending',
						queue: 'default',
						priority: 5,
						attempts: 0,
						maxRetries: 3,
						backoff: { type: 'exponential', delay: 1000 },
						timeout: 30000,
						uniqueKey: 'race-key',
						createdAt: '2025-01-01T00:00:00.000Z',
						updatedAt: '2025-01-01T00:00:00.000Z',
					},
				],
			});

			const job = await adapter.enqueue('email:send', {}, { uniqueKey: 'race-key' });

			expect(job.id).toBe('winner-id');
			expect(mock.getQueries()).toHaveLength(4); // INSERT, SELECT, retry INSERT, final SELECT

			// Verify retry INSERT uses ON CONFLICT
			const retryQuery = mock.getQueries()[2];
			expect(retryQuery?.text).toContain('ON CONFLICT');

			// Verify final SELECT targets uniqueKey
			const finalSelect = mock.getQueries()[3];
			expect(finalSelect?.text).toContain('SELECT');
			expect(finalSelect?.text).toContain('"uniqueKey"');
		});

		it('should throw when retry insert and final select both fail', async () => {
			// INSERT returns empty (conflict)
			mock.queueResult({ rows: [] });
			// SELECT returns empty (race condition)
			mock.queueResult({ rows: [] });
			// Retry INSERT also returns empty (concurrent conflict)
			mock.queueResult({ rows: [] });
			// Final SELECT also returns empty (job completed again)
			mock.queueResult({ rows: [] });

			await expect(adapter.enqueue('email:send', {}, { uniqueKey: 'fail-key' })).rejects.toThrow(
				'Failed to enqueue job after deduplication retry',
			);
		});
	});

	describe('failJob backoff calculation', () => {
		it('should apply exponential backoff: delay * 2^(attempt-1)', async () => {
			mock.queueResult({
				rows: [{ attempts: 2, maxRetries: 5, backoff: { type: 'exponential', delay: 1000 } }],
			});

			const beforeMs = Date.now();
			await adapter.failJob('job-1', 'error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			// runAt = $2 parameter in the retry UPDATE
			const runAt = updateQuery.values[1];
			expect(typeof runAt).toBe('string');
			// exponential: 1000 * 2^(2-1) = 2000ms
			const runAtMs = new Date(runAt as string).getTime();
			expect(runAtMs).toBeGreaterThanOrEqual(beforeMs + 1900);
			expect(runAtMs).toBeLessThanOrEqual(beforeMs + 3000);
		});

		it('should apply linear backoff: delay * attempt', async () => {
			mock.queueResult({
				rows: [{ attempts: 3, maxRetries: 5, backoff: { type: 'linear', delay: 500 } }],
			});

			const beforeMs = Date.now();
			await adapter.failJob('job-2', 'error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			const runAt = updateQuery.values[1];
			// linear: 500 * 3 = 1500ms
			const runAtMs = new Date(runAt as string).getTime();
			expect(runAtMs).toBeGreaterThanOrEqual(beforeMs + 1400);
			expect(runAtMs).toBeLessThanOrEqual(beforeMs + 2500);
		});

		it('should apply fixed backoff: always the same delay', async () => {
			mock.queueResult({
				rows: [{ attempts: 1, maxRetries: 5, backoff: { type: 'fixed', delay: 3000 } }],
			});

			const beforeMs = Date.now();
			await adapter.failJob('job-3', 'error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			const runAt = updateQuery.values[1];
			// fixed: always 3000ms
			const runAtMs = new Date(runAt as string).getTime();
			expect(runAtMs).toBeGreaterThanOrEqual(beforeMs + 2900);
			expect(runAtMs).toBeLessThanOrEqual(beforeMs + 4000);
		});

		it('should cap exponential backoff at maxDelay', async () => {
			mock.queueResult({
				rows: [
					{
						attempts: 10,
						maxRetries: 20,
						backoff: { type: 'exponential', delay: 1000, maxDelay: 5000 },
					},
				],
			});

			const beforeMs = Date.now();
			await adapter.failJob('job-4', 'error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			const runAt = updateQuery.values[1];
			// 1000 * 2^9 = 512000 but capped at maxDelay 5000
			const runAtMs = new Date(runAt as string).getTime();
			expect(runAtMs).toBeGreaterThanOrEqual(beforeMs + 4900);
			expect(runAtMs).toBeLessThanOrEqual(beforeMs + 6000);
		});

		it('should only fail jobs in active status (status guard on SELECT)', async () => {
			mock.queueResult({
				rows: [{ attempts: 1, maxRetries: 3, backoff: null }],
			});

			await adapter.failJob('job-123', 'error');

			const queries = mock.getQueries();
			const selectQuery = queries[0] ?? { text: '', values: [] };
			// SELECT must include status guard to prevent racing with recoverStalledJobs
			expect(selectQuery.text).toContain('"status" = \'active\'');
		});

		it('should include status guard on retry UPDATE', async () => {
			mock.queueResult({
				rows: [{ attempts: 1, maxRetries: 3, backoff: { type: 'fixed', delay: 1000 } }],
			});

			await adapter.failJob('job-123', 'error');

			const queries = mock.getQueries();
			const updateQuery = queries[queries.length - 1] ?? { text: '', values: [] };
			// UPDATE must also guard status to prevent overwriting concurrent recovery
			expect(updateQuery.text).toContain('"status" = \'active\'');
		});

		it('should silently return when job not found', async () => {
			// No result from SELECT
			mock.queueResult({ rows: [] });

			// Should not throw
			await adapter.failJob('nonexistent', 'error');

			// Only the SELECT query, no UPDATE
			expect(mock.getQueries()).toHaveLength(1);
		});
	});
});

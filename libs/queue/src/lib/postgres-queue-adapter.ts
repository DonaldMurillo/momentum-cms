/**
 * PostgreSQL queue adapter using SKIP LOCKED for reliable concurrent job processing.
 *
 * Uses raw SQL via pg.Pool (shared with the main database adapter).
 * The queue-jobs collection handles table creation; this adapter handles
 * the SKIP LOCKED hot path and queue-specific operations.
 */

import type {
	BackoffStrategy,
	EnqueueOptions,
	FetchJobsOptions,
	Job,
	JobPriority,
	JobQueryOptions,
	JobQueryResult,
	JobStatus,
	QueueAdapter,
	QueueStats,
} from '@momentumcms/core';

/** Options for the PostgreSQL queue adapter. */
export interface PostgresQueueAdapterOptions {
	/** pg Pool instance (shared with the main DB adapter via getPool()) */
	pool: {
		query(
			text: string,
			values?: unknown[],
		): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
	};
	/** Table name for the queue-jobs collection. @default 'queue-jobs' */
	tableName?: string;
}

// ============================================
// Type-safe row converters (no type assertions)
// ============================================

const JOB_STATUS_SET = new Set<string>(['pending', 'active', 'completed', 'failed', 'dead']);

function isJobStatus(val: unknown): val is JobStatus {
	return typeof val === 'string' && JOB_STATUS_SET.has(val);
}

function toJobStatus(val: unknown): JobStatus {
	if (isJobStatus(val)) return val;
	return 'pending';
}

const VALID_PRIORITIES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

function isJobPriority(val: unknown): val is JobPriority {
	return typeof val === 'number' && VALID_PRIORITIES.has(val);
}

function toJobPriority(val: unknown): JobPriority {
	if (isJobPriority(val)) return val;
	return 5;
}

function isBackoffStrategy(val: unknown): val is BackoffStrategy {
	if (typeof val !== 'object' || val === null) return false;
	if (!('type' in val) || !('delay' in val)) return false;
	return typeof val.type === 'string' && typeof val.delay === 'number';
}

function toBackoff(val: unknown): BackoffStrategy {
	if (isBackoffStrategy(val)) return val;
	return DEFAULT_BACKOFF;
}

function toNumber(val: unknown, fallback = 0): number {
	if (typeof val === 'number') return val;
	return fallback;
}

function toOptionalString(val: unknown): string | undefined {
	if (typeof val === 'string') return val;
	return undefined;
}

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toOptionalRecord(val: unknown): Record<string, unknown> | undefined {
	if (isRecord(val)) return val;
	return undefined;
}

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

function toISOString(value: unknown): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	return String(value);
}

function toOptionalISOString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'string') return value;
	return undefined;
}

function mapRow(row: Record<string, unknown>): Job {
	return {
		id: String(row['id'] ?? ''),
		type: String(row['type'] ?? ''),
		payload: row['payload'],
		status: toJobStatus(row['status']),
		queue: String(row['queue'] ?? 'default'),
		priority: toJobPriority(row['priority']),
		attempts: toNumber(row['attempts']),
		maxRetries: toNumber(row['maxRetries'], 3),
		backoff: toBackoff(row['backoff']),
		timeout: toNumber(row['timeout'], 30000),
		uniqueKey: toOptionalString(row['uniqueKey']),
		runAt: row['runAt'] ? toISOString(row['runAt']) : null,
		startedAt: toOptionalISOString(row['startedAt']),
		finishedAt: toOptionalISOString(row['finishedAt']),
		lastError: toOptionalString(row['lastError']),
		metadata: toOptionalRecord(row['metadata']),
		createdAt: toISOString(row['createdAt']),
		updatedAt: toISOString(row['updatedAt']),
	};
}

function calculateBackoffDelay(backoff: BackoffStrategy, attempt: number): number {
	const maxDelay = backoff.maxDelay ?? 300000; // 5 minutes default cap
	let delay: number;

	switch (backoff.type) {
		case 'exponential':
			delay = Math.min(backoff.delay * Math.pow(2, attempt - 1), maxDelay);
			break;
		case 'linear':
			delay = Math.min(backoff.delay * attempt, maxDelay);
			break;
		case 'fixed':
		default:
			delay = backoff.delay;
	}

	return delay;
}

/**
 * Create a PostgreSQL-backed queue adapter.
 *
 * @param options - Adapter options (pool is required)
 * @returns QueueAdapter implementation
 */
export function postgresQueueAdapter(options: PostgresQueueAdapterOptions): QueueAdapter {
	const { pool, tableName = 'queue-jobs' } = options;
	if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tableName)) {
		throw new Error(
			`Invalid table name: "${tableName}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
		);
	}
	const table = `"${tableName}"`;

	async function query(text: string, values?: unknown[]): Promise<Record<string, unknown>[]> {
		const result = await pool.query(text, values);
		return result.rows;
	}

	async function queryOne(
		text: string,
		values?: unknown[],
	): Promise<Record<string, unknown> | undefined> {
		const rows = await query(text, values);
		return rows[0];
	}

	return {
		async initialize(): Promise<void> {
			// Create partial unique index for deduplication
			// (collection system handles the table + standard indexes)
			await pool.query(`
				CREATE UNIQUE INDEX IF NOT EXISTS "idx_queue_jobs_unique_key"
				ON ${table} ("uniqueKey")
				WHERE "uniqueKey" IS NOT NULL AND "status" IN ('pending', 'active')
			`);
		},

		async enqueue(type: string, payload: unknown, opts?: EnqueueOptions): Promise<Job> {
			const id = generateId();
			const now = new Date().toISOString();
			const queueName = opts?.queue ?? 'default';
			const priority = opts?.priority ?? 5;
			const maxRetries = opts?.maxRetries ?? 3;
			const backoff = opts?.backoff ?? DEFAULT_BACKOFF;
			const timeout = opts?.timeout ?? 30000;
			const uniqueKey = opts?.uniqueKey ?? null;
			const metadata = opts?.metadata ?? null;
			const runAt = opts?.runAt
				? typeof opts.runAt === 'string'
					? opts.runAt
					: opts.runAt.toISOString()
				: null;

			const values = [
				id,
				type,
				JSON.stringify(payload),
				queueName,
				priority,
				maxRetries,
				JSON.stringify(backoff),
				timeout,
				uniqueKey,
				runAt,
				metadata ? JSON.stringify(metadata) : null,
				now,
			];

			// When no uniqueKey, use plain INSERT — no dedup needed
			if (!uniqueKey) {
				const rows = await query(
					`INSERT INTO ${table}
					("id", "type", "payload", "status", "queue", "priority",
					 "attempts", "maxRetries", "backoff", "timeout",
					 "uniqueKey", "runAt", "metadata", "createdAt", "updatedAt")
					VALUES ($1, $2, $3, 'pending', $4, $5, 0, $6, $7, $8, $9, $10, $11, $12, $12)
					RETURNING *`,
					values,
				);
				const firstRow = rows[0];
				if (!firstRow) {
					throw new Error('Insert returned no rows');
				}
				return mapRow(firstRow);
			}

			// With uniqueKey: target the specific partial unique index for dedup
			const rows = await query(
				`INSERT INTO ${table}
				("id", "type", "payload", "status", "queue", "priority",
				 "attempts", "maxRetries", "backoff", "timeout",
				 "uniqueKey", "runAt", "metadata", "createdAt", "updatedAt")
				VALUES ($1, $2, $3, 'pending', $4, $5, 0, $6, $7, $8, $9, $10, $11, $12, $12)
				ON CONFLICT ("uniqueKey") WHERE "uniqueKey" IS NOT NULL AND "status" IN ('pending', 'active') DO NOTHING
				RETURNING *`,
				values,
			);

			// If ON CONFLICT skipped (duplicate uniqueKey), find the existing job
			if (rows.length === 0) {
				const existing = await queryOne(
					`SELECT * FROM ${table}
					WHERE "uniqueKey" = $1 AND "status" IN ('pending', 'active')
					LIMIT 1`,
					[uniqueKey],
				);
				if (existing) {
					return mapRow(existing);
				}
				// Race condition: job was completed between insert and select, retry insert
				const retryRows = await query(
					`INSERT INTO ${table}
					("id", "type", "payload", "status", "queue", "priority",
					 "attempts", "maxRetries", "backoff", "timeout",
					 "uniqueKey", "runAt", "metadata", "createdAt", "updatedAt")
					VALUES ($1, $2, $3, 'pending', $4, $5, 0, $6, $7, $8, $9, $10, $11, $12, $12)
					ON CONFLICT ("uniqueKey") WHERE "uniqueKey" IS NOT NULL AND "status" IN ('pending', 'active') DO NOTHING
					RETURNING *`,
					values,
				);
				const retryRow = retryRows[0];
				if (retryRow) {
					return mapRow(retryRow);
				}
				// Another concurrent enqueue won the race — return that job
				const raceWinner = await queryOne(
					`SELECT * FROM ${table}
					WHERE "uniqueKey" = $1 AND "status" IN ('pending', 'active')
					LIMIT 1`,
					[uniqueKey],
				);
				if (raceWinner) {
					return mapRow(raceWinner);
				}
				throw new Error('Failed to enqueue job after deduplication retry');
			}

			const firstRow = rows[0];
			if (!firstRow) {
				throw new Error('Insert returned no rows');
			}
			return mapRow(firstRow);
		},

		async fetchJobs(opts?: FetchJobsOptions): Promise<Job[]> {
			const queueName = opts?.queue ?? 'default';
			const limit = opts?.limit ?? 1;

			const rows = await query(
				`UPDATE ${table}
				SET "status" = 'active',
					"startedAt" = NOW(),
					"attempts" = "attempts" + 1,
					"updatedAt" = NOW()
				WHERE "id" IN (
					SELECT "id" FROM ${table}
					WHERE "queue" = $1
						AND "status" = 'pending'
						AND ("runAt" IS NULL OR "runAt" <= NOW())
					ORDER BY "priority" ASC, "runAt" ASC NULLS FIRST, "createdAt" ASC
					LIMIT $2
					FOR UPDATE SKIP LOCKED
				)
				RETURNING *`,
				[queueName, limit],
			);

			return rows.map(mapRow);
		},

		async completeJob(jobId: string): Promise<void> {
			await pool.query(
				`UPDATE ${table}
				SET "status" = 'completed', "finishedAt" = NOW(), "updatedAt" = NOW()
				WHERE "id" = $1 AND "status" = 'active'`,
				[jobId],
			);
		},

		async failJob(jobId: string, error: string): Promise<void> {
			const row = await queryOne(
				`SELECT "attempts", "maxRetries", "backoff" FROM ${table}
				WHERE "id" = $1 AND "status" = 'active'`,
				[jobId],
			);
			if (!row) return; // Job no longer active — another process handled it

			const attempts = toNumber(row['attempts']);
			const maxRetries = toNumber(row['maxRetries'], 3);
			const backoff = toBackoff(row['backoff']);

			if (attempts >= maxRetries) {
				// Move to dead letter queue
				await pool.query(
					`UPDATE ${table}
					SET "status" = 'dead',
						"lastError" = $1,
						"finishedAt" = NOW(),
						"updatedAt" = NOW()
					WHERE "id" = $2 AND "status" = 'active'`,
					[error, jobId],
				);
			} else {
				// Schedule retry with backoff
				const delay = calculateBackoffDelay(backoff, attempts);
				const runAt = new Date(Date.now() + delay).toISOString();

				await pool.query(
					`UPDATE ${table}
					SET "status" = 'pending',
						"lastError" = $1,
						"runAt" = $2,
						"updatedAt" = NOW()
					WHERE "id" = $3 AND "status" = 'active'`,
					[error, runAt, jobId],
				);
			}
		},

		async queryJobs(opts?: JobQueryOptions): Promise<JobQueryResult> {
			const limit = opts?.limit ?? 50;
			const page = opts?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions: string[] = [];
			const params: unknown[] = [];
			let paramIdx = 1;

			if (opts?.status) {
				conditions.push(`"status" = $${paramIdx++}`);
				params.push(opts.status);
			}
			if (opts?.queue) {
				conditions.push(`"queue" = $${paramIdx++}`);
				params.push(opts.queue);
			}
			if (opts?.type) {
				conditions.push(`"type" = $${paramIdx++}`);
				params.push(opts.type);
			}

			const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

			const countRow = await queryOne(`SELECT COUNT(*) as count FROM ${table} ${where}`, params);
			const total = parseInt(String(countRow?.['count'] ?? '0'), 10);

			const rows = await query(
				`SELECT * FROM ${table} ${where}
				ORDER BY "createdAt" DESC
				LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
				[...params, limit, offset],
			);

			return {
				jobs: rows.map(mapRow),
				total,
				page,
				limit,
			};
		},

		async getStats(queueName?: string): Promise<QueueStats[]> {
			const where = queueName ? `WHERE "queue" = $1` : '';
			const params = queueName ? [queueName] : [];

			const rows = await query(
				`SELECT "queue", "status", COUNT(*) as count
				FROM ${table} ${where}
				GROUP BY "queue", "status"
				ORDER BY "queue"`,
				params,
			);

			// Group by queue name
			const statsMap = new Map<string, QueueStats>();

			for (const row of rows) {
				const q = String(row['queue'] ?? '');
				if (!statsMap.has(q)) {
					const emptyCounts: Record<JobStatus, number> = {
						pending: 0,
						active: 0,
						completed: 0,
						failed: 0,
						dead: 0,
					};
					statsMap.set(q, { queue: q, counts: emptyCounts });
				}
				const stats = statsMap.get(q);
				if (stats) {
					const status = String(row['status'] ?? '');
					if (isJobStatus(status)) {
						stats.counts[status] = parseInt(String(row['count']), 10);
					}
				}
			}

			// Calculate oldest pending age per queue
			for (const [q, stats] of statsMap) {
				if (stats.counts.pending > 0) {
					const oldest = await queryOne(
						`SELECT EXTRACT(EPOCH FROM (NOW() - MIN("createdAt"))) * 1000 as age_ms
						FROM ${table}
						WHERE "queue" = $1 AND "status" = 'pending'`,
						[q],
					);
					const ageMs = oldest?.['age_ms'];
					if (ageMs !== null && ageMs !== undefined) {
						stats.oldestPendingAge = Math.round(parseFloat(String(ageMs)));
					}
				}
			}

			return Array.from(statsMap.values());
		},

		async getJob(jobId: string): Promise<Job | null> {
			const row = await queryOne(`SELECT * FROM ${table} WHERE "id" = $1`, [jobId]);
			return row ? mapRow(row) : null;
		},

		async deleteJob(jobId: string): Promise<boolean> {
			const result = await pool.query(`DELETE FROM ${table} WHERE "id" = $1`, [jobId]);
			return result.rowCount > 0;
		},

		async purgeJobs(
			olderThanMs: number,
			status: 'completed' | 'dead' = 'completed',
		): Promise<number> {
			const threshold = new Date(Date.now() - olderThanMs).toISOString();
			const result = await pool.query(
				`DELETE FROM ${table}
				WHERE "status" = $1 AND "finishedAt" < $2`,
				[status, threshold],
			);
			return result.rowCount;
		},

		async retryJob(jobId: string): Promise<Job> {
			const rows = await query(
				`UPDATE ${table}
				SET "status" = 'pending',
					"attempts" = 0,
					"lastError" = NULL,
					"finishedAt" = NULL,
					"startedAt" = NULL,
					"runAt" = NULL,
					"updatedAt" = NOW()
				WHERE "id" = $1 AND "status" = 'dead'
				RETURNING *`,
				[jobId],
			);

			const row = rows[0];
			if (!row) {
				throw new Error(`Job ${jobId} not found or not in dead status`);
			}

			return mapRow(row);
		},

		async recoverStalledJobs(): Promise<number> {
			// Use CTE with FOR UPDATE SKIP LOCKED to prevent two concurrent
			// recovery calls from acting on the same stalled job.
			const result = await pool.query(
				`WITH stalled AS (
					SELECT "id" FROM ${table}
					WHERE "status" = 'active'
						AND "startedAt" IS NOT NULL
						AND "startedAt" + ("timeout" || ' milliseconds')::interval < NOW()
					FOR UPDATE SKIP LOCKED
				)
				UPDATE ${table}
				SET "status" = CASE
					WHEN "attempts" >= "maxRetries" THEN 'dead'
					ELSE 'pending'
				END,
				"lastError" = 'Job stalled (timeout exceeded)',
				"finishedAt" = CASE
					WHEN "attempts" >= "maxRetries" THEN NOW()
					ELSE NULL
				END,
				"runAt" = CASE
					WHEN "attempts" < "maxRetries" THEN NOW()
					ELSE NULL
				END,
				"updatedAt" = NOW()
				WHERE "id" IN (SELECT "id" FROM stalled)`,
			);

			return result.rowCount;
		},

		async shutdown(): Promise<void> {
			// Pool is shared, don't close it here
		},
	};
}

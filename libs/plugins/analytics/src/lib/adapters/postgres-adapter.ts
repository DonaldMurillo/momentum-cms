/**
 * PostgreSQL Analytics Adapter
 *
 * Stores analytics events in a PostgreSQL table with JSONB columns.
 * Uses the `pg` package (same as @momentum-cms/db-drizzle).
 */

import type { Pool as PgPool, PoolConfig } from 'pg';
import { createLogger } from '@momentum-cms/logger';
import type { AnalyticsAdapter } from '../analytics-config.types';
import type {
	AnalyticsEvent,
	AnalyticsQueryOptions,
	AnalyticsQueryResult,
} from '../analytics-event.types';

/**
 * PostgreSQL analytics adapter options.
 */
export interface PostgresAnalyticsAdapterOptions {
	/** PostgreSQL connection string */
	connectionString: string;
	/** Maximum pool size. @default 5 */
	poolSize?: number;
	/** Table name. @default '_momentum_analytics' */
	tableName?: string;
}

/**
 * PostgreSQL analytics adapter.
 *
 * @example
 * ```typescript
 * import { postgresAnalyticsAdapter } from '@momentum-cms/plugins/analytics';
 *
 * const adapter = postgresAnalyticsAdapter({
 *   connectionString: process.env.DATABASE_URL,
 * });
 * ```
 */
export function postgresAnalyticsAdapter(
	options: PostgresAnalyticsAdapterOptions,
): AnalyticsAdapter {
	const logger = createLogger('Analytics:Postgres');
	const tableName = options.tableName ?? '_momentum_analytics';

	// Lazy pool creation to avoid requiring `pg` at import time
	let pool: PgPool | null = null;

	function getPool(): PgPool {
		if (!pool) {
			// Dynamic require so the adapter works as an optional feature
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic import of optional peer dep
			const pg = require('pg') as { Pool: new (config: PoolConfig) => PgPool };
			pool = new pg.Pool({
				connectionString: options.connectionString,
				max: options.poolSize ?? 5,
			});
		}
		return pool;
	}

	const adapter: AnalyticsAdapter = {
		async initialize(): Promise<void> {
			const p = getPool();
			await p.query(`
				CREATE TABLE IF NOT EXISTS ${tableName} (
					id TEXT PRIMARY KEY,
					category TEXT NOT NULL,
					name TEXT NOT NULL,
					timestamp TIMESTAMPTZ NOT NULL,
					session_id TEXT,
					user_id TEXT,
					visitor_id TEXT,
					properties JSONB NOT NULL DEFAULT '{}',
					context JSONB NOT NULL DEFAULT '{}'
				)
			`);

			// Indexes for common query patterns
			await p.query(`
				CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp ON ${tableName} (timestamp DESC)
			`);
			await p.query(`
				CREATE INDEX IF NOT EXISTS idx_${tableName}_category ON ${tableName} (category)
			`);
			await p.query(`
				CREATE INDEX IF NOT EXISTS idx_${tableName}_name ON ${tableName} (name)
			`);

			logger.info(`Table "${tableName}" initialized`);
		},

		async store(events: AnalyticsEvent[]): Promise<void> {
			if (events.length === 0) return;

			const p = getPool();

			// Build batch INSERT with parameterized values (9 columns per row)
			const rows: string[] = [];
			const values: unknown[] = [];

			for (let i = 0; i < events.length; i++) {
				const e = events[i];
				const offset = i * 9;
				rows.push(
					`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
				);
				values.push(
					e.id,
					e.category,
					e.name,
					e.timestamp,
					e.sessionId ?? null,
					e.userId ?? null,
					e.visitorId ?? null,
					JSON.stringify(e.properties),
					JSON.stringify(e.context),
				);
			}

			const sql = `
				INSERT INTO ${tableName} (id, category, name, timestamp, session_id, user_id, visitor_id, properties, context)
				VALUES ${rows.join(', ')}
				ON CONFLICT (id) DO NOTHING
			`;

			await p.query(sql, values);
		},

		async query(queryOptions: AnalyticsQueryOptions = {}): Promise<AnalyticsQueryResult> {
			const p = getPool();
			const conditions: string[] = [];
			const params: unknown[] = [];
			let paramIdx = 1;

			if (queryOptions.category) {
				conditions.push(`category = $${paramIdx++}`);
				params.push(queryOptions.category);
			}
			if (queryOptions.name) {
				conditions.push(`name = $${paramIdx++}`);
				params.push(queryOptions.name);
			}
			if (queryOptions.collection) {
				conditions.push(`context->>'collection' = $${paramIdx++}`);
				params.push(queryOptions.collection);
			}
			if (queryOptions.search) {
				const searchPattern = `%${queryOptions.search}%`;
				conditions.push(
					`(name ILIKE $${paramIdx} OR context->>'url' ILIKE $${paramIdx} OR context->>'collection' ILIKE $${paramIdx})`,
				);
				params.push(searchPattern);
				paramIdx++;
			}
			if (queryOptions.from) {
				conditions.push(`timestamp >= $${paramIdx++}`);
				params.push(queryOptions.from);
			}
			if (queryOptions.to) {
				conditions.push(`timestamp <= $${paramIdx++}`);
				params.push(queryOptions.to);
			}

			const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
			const limit = Math.min(queryOptions.limit ?? 50, 10000);
			const page = queryOptions.page ?? 1;
			const offset = (page - 1) * limit;

			// Count query
			const countResult = await p.query(
				`SELECT COUNT(*)::int AS count FROM ${tableName} ${where}`,
				params,
			);
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg returns rows as Record
			const total = (countResult.rows[0] as { count: number }).count;

			// Data query
			const dataResult = await p.query(
				`SELECT * FROM ${tableName} ${where} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`,
				params,
			);

			const events: AnalyticsEvent[] = dataResult.rows.map(rowToEvent);

			return { events, total, page, limit };
		},

		async shutdown(): Promise<void> {
			if (pool) {
				await pool.end();
				pool = null;
				logger.info('Connection pool closed');
			}
		},
	};

	return adapter;
}

/**
 * Convert a PostgreSQL row to an AnalyticsEvent.
 */
function rowToEvent(row: Record<string, unknown>): AnalyticsEvent {
	return {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		id: row['id'] as string,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		category: row['category'] as AnalyticsEvent['category'],
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		name: row['name'] as string,
		timestamp:
			row['timestamp'] instanceof Date ? row['timestamp'].toISOString() : String(row['timestamp']),
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		sessionId: (row['session_id'] as string) ?? undefined,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		userId: (row['user_id'] as string) ?? undefined,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row fields
		visitorId: (row['visitor_id'] as string) ?? undefined,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg JSONB auto-parses
		properties: (row['properties'] as Record<string, unknown>) ?? {},
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg JSONB auto-parses
		context: (row['context'] as AnalyticsEvent['context']) ?? { source: 'server' },
	};
}

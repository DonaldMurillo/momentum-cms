/**
 * Adapter Wiring
 *
 * Bridges raw database connections (pg.Pool, better-sqlite3.Database)
 * to the migration system's interface contracts.
 */
import type { Pool } from 'pg';
import { Client } from 'pg';
import type Database from 'better-sqlite3';
import type {
	TrackerQueryFn,
	PushRunnerDb,
	DataHelperDb,
	CloneCapableDb,
	MigrationContext,
} from '@momentumcms/migrations';
import type { QueryFunction } from '@momentumcms/migrations';
import type { SqliteQueryFunction } from '@momentumcms/migrations';
import { createDataHelpers } from '@momentumcms/migrations';

// ============================================
// PostgreSQL Wiring
// ============================================

/**
 * Create a TrackerQueryFn from a pg.Pool.
 */
export function pgTracker(pool: Pool): TrackerQueryFn {
	return {
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const result = await pool.query(sql, params);
			return result.rows as T[];
		},
		async execute(sql: string, params?: unknown[]): Promise<number> {
			const result = await pool.query(sql, params);
			return result.rowCount ?? 0;
		},
	};
}

/**
 * Create a PushRunnerDb from a pg.Pool.
 */
export function pgPushDb(pool: Pool): PushRunnerDb {
	return {
		async executeRaw(sql: string): Promise<number> {
			const result = await pool.query(sql);
			return result.rowCount ?? 0;
		},
	};
}

/**
 * Create a DataHelperDb from a pg.Pool.
 */
export function pgDataDb(pool: Pool): DataHelperDb {
	return {
		async execute(sql: string, params?: unknown[]): Promise<number> {
			const result = await pool.query(sql, params);
			return result.rowCount ?? 0;
		},
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const result = await pool.query(sql, params);
			return result.rows as T[];
		},
	};
}

/**
 * Create a QueryFunction (for introspection) from a pg.Pool.
 */
export function pgQueryFn(pool: Pool): QueryFunction {
	return async <T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> => {
		const result = await pool.query(sql, params);
		return result.rows as T[];
	};
}

/**
 * Build a MigrationContext from a pg.Pool.
 */
export function buildPgContext(pool: Pool): MigrationContext {
	const db = pgDataDb(pool);
	const helpers = createDataHelpers(db, 'postgresql');
	return {
		async sql(query: string, params?: unknown[]): Promise<void> {
			await pool.query(query, params);
		},
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const result = await pool.query(sql, params);
			return result.rows as T[];
		},
		data: helpers,
		dialect: 'postgresql',
		log: { info: (): void => {}, warn: (): void => {} },
	};
}

/**
 * Create a CloneCapableDb for PostgreSQL.
 * Uses CREATE DATABASE ... TEMPLATE for cloning.
 */
export function pgCloneDb(connectionString: string): CloneCapableDb {
	const adminUrl = connectionString.replace(/\/[^/]*$/, '/postgres');
	const sourceDb = connectionString.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? '';

	return {
		async cloneDatabase(targetName: string): Promise<string> {
			const client = new Client({ connectionString: adminUrl });
			await client.connect();
			try {
				// Terminate other connections to allow TEMPLATE usage
				await client.query(
					`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
					[sourceDb],
				);
				await client.query(`CREATE DATABASE "${targetName}" TEMPLATE "${sourceDb}"`);
			} finally {
				await client.end();
			}
			return targetName;
		},
		async dropClone(targetName: string): Promise<void> {
			const client = new Client({ connectionString: adminUrl });
			await client.connect();
			try {
				await client.query(`DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`);
			} finally {
				await client.end();
			}
		},
	};
}

/**
 * Create a pg.Pool connected to a specific database by name.
 * Derives the connection string from PG_CONNECTION env var.
 */
export function pgPoolForDb(dbName: string): Pool {
	// Dynamic require to avoid top-level import issues
	const pg = require('pg') as typeof import('pg');
	const base = (process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres')
		.replace(/\/[^/]*$/, '');
	return new pg.Pool({ connectionString: `${base}/${dbName}`, max: 5 });
}

// ============================================
// SQLite Wiring
// ============================================

/**
 * Create a TrackerQueryFn from a better-sqlite3 Database.
 */
export function sqliteTracker(db: Database.Database): TrackerQueryFn {
	return {
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const stmt = db.prepare(sql);
			const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
			return rows as T[];
		},
		async execute(sql: string, params?: unknown[]): Promise<number> {
			const stmt = db.prepare(sql);
			const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
			return result.changes;
		},
	};
}

/**
 * Create a PushRunnerDb from a better-sqlite3 Database.
 */
export function sqlitePushDb(db: Database.Database): PushRunnerDb {
	return {
		async executeRaw(sql: string): Promise<number> {
			db.exec(sql);
			return 0;
		},
	};
}

/**
 * Create a DataHelperDb from a better-sqlite3 Database.
 */
export function sqliteDataDb(db: Database.Database): DataHelperDb {
	return {
		async execute(sql: string, params?: unknown[]): Promise<number> {
			const stmt = db.prepare(sql);
			const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
			return result.changes;
		},
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const stmt = db.prepare(sql);
			const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
			return rows as T[];
		},
	};
}

/**
 * Create a SqliteQueryFunction (for introspection) from a better-sqlite3 Database.
 */
export function sqliteQueryFn(db: Database.Database): SqliteQueryFunction {
	return async <T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> => {
		const stmt = db.prepare(sql);
		const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
		return rows as T[];
	};
}

/**
 * Build a MigrationContext from a better-sqlite3 Database.
 */
export function buildSqliteContext(db: Database.Database): MigrationContext {
	const dataDb = sqliteDataDb(db);
	const helpers = createDataHelpers(dataDb, 'sqlite');
	return {
		async sql(query: string, params?: unknown[]): Promise<void> {
			const stmt = db.prepare(query);
			if (params && params.length > 0) {
				stmt.run(...params);
			} else {
				stmt.run();
			}
		},
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const stmt = db.prepare(sql);
			const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
			return rows as T[];
		},
		data: helpers,
		dialect: 'sqlite',
		log: { info: (): void => {}, warn: (): void => {} },
	};
}

import { Pool, type QueryResult } from 'pg';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter, CollectionConfig, Field } from '@momentum-cms/core';

/**
 * PostgreSQL adapter options.
 */
export interface PostgresAdapterOptions {
	/**
	 * PostgreSQL connection string.
	 * Format: postgresql://user:password@host:port/database
	 */
	connectionString: string;
	/**
	 * Maximum number of clients in the pool.
	 * @default 10
	 */
	max?: number;
}

/**
 * Maps field types to PostgreSQL column types.
 */
function getColumnType(field: Field): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
			return 'TEXT';
		case 'email':
		case 'slug':
		case 'select':
			return 'VARCHAR(255)';
		case 'number':
			return 'NUMERIC';
		case 'checkbox':
			return 'BOOLEAN';
		case 'date':
			return 'TIMESTAMPTZ';
		case 'relationship':
			return 'VARCHAR(36)';
		case 'array':
		case 'group':
		case 'blocks':
		case 'json':
			return 'JSONB';
		default:
			return 'TEXT';
	}
}

/**
 * Creates the SQL for a collection's table.
 * Note: All column names are quoted to preserve case in PostgreSQL.
 */
function createTableSql(collection: CollectionConfig): string {
	const columns: string[] = [
		'"id" VARCHAR(36) PRIMARY KEY',
		'"createdAt" TIMESTAMPTZ NOT NULL',
		'"updatedAt" TIMESTAMPTZ NOT NULL',
	];

	for (const field of collection.fields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	return `CREATE TABLE IF NOT EXISTS "${collection.slug}" (${columns.join(', ')})`;
}

/**
 * SQL statements to create Better Auth required tables.
 * These tables must exist before Better Auth can function.
 */
const AUTH_TABLES_SQL = `
	CREATE TABLE IF NOT EXISTS "user" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"name" TEXT NOT NULL,
		"email" VARCHAR(255) NOT NULL UNIQUE,
		"emailVerified" BOOLEAN NOT NULL DEFAULT false,
		"image" TEXT,
		"role" VARCHAR(50) NOT NULL DEFAULT 'user',
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE TABLE IF NOT EXISTS "session" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"userId" VARCHAR(36) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
		"token" TEXT NOT NULL UNIQUE,
		"expiresAt" TIMESTAMPTZ NOT NULL,
		"ipAddress" TEXT,
		"userAgent" TEXT,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE TABLE IF NOT EXISTS "account" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"userId" VARCHAR(36) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
		"accountId" TEXT NOT NULL,
		"providerId" TEXT NOT NULL,
		"accessToken" TEXT,
		"refreshToken" TEXT,
		"accessTokenExpiresAt" TIMESTAMPTZ,
		"refreshTokenExpiresAt" TIMESTAMPTZ,
		"scope" TEXT,
		"idToken" TEXT,
		"password" TEXT,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE TABLE IF NOT EXISTS "verification" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"identifier" TEXT NOT NULL,
		"value" TEXT NOT NULL,
		"expiresAt" TIMESTAMPTZ NOT NULL,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");
	CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session"("token");
	CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
	CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
`;

/**
 * Extended adapter interface that includes raw database access for Better Auth.
 */
export interface PostgresAdapterWithRaw extends DatabaseAdapter {
	/** Get the pg Pool instance for Better Auth integration */
	getPool(): Pool;
	/** Execute a raw SQL query */
	query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	/** Execute a raw SQL query and return a single row */
	queryOne<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
	/** Execute a raw SQL statement (INSERT, UPDATE, DELETE) */
	execute(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * Creates a PostgreSQL database adapter.
 */
export function postgresAdapter(options: PostgresAdapterOptions): PostgresAdapterWithRaw {
	const pool = new Pool({
		connectionString: options.connectionString,
		max: options.max ?? 10,
	});

	/**
	 * Execute a query and return all rows.
	 */
	async function query<T extends Record<string, unknown>>(
		sql: string,
		params: unknown[] = [],
	): Promise<T[]> {
		const result: QueryResult = await pool.query(sql, params);
		return result.rows.filter((row): row is T => typeof row === 'object' && row !== null);
	}

	/**
	 * Execute a query and return a single row.
	 */
	async function queryOne<T extends Record<string, unknown>>(
		sql: string,
		params: unknown[] = [],
	): Promise<T | null> {
		const rows = await query<T>(sql, params);
		return rows[0] ?? null;
	}

	/**
	 * Execute a statement and return the number of affected rows.
	 */
	async function execute(sql: string, params: unknown[] = []): Promise<number> {
		const result: QueryResult = await pool.query(sql, params);
		return result.rowCount ?? 0;
	}

	return {
		/**
		 * Get the pg Pool instance for Better Auth integration.
		 */
		getPool(): Pool {
			return pool;
		},

		/**
		 * Execute a raw SQL query.
		 */
		query,

		/**
		 * Execute a raw SQL query and return a single row.
		 */
		queryOne,

		/**
		 * Execute a raw SQL statement.
		 */
		execute,

		async initialize(collections: CollectionConfig[]): Promise<void> {
			// Create Better Auth tables first
			await pool.query(AUTH_TABLES_SQL);

			// Then create collection tables
			for (const collection of collections) {
				const createSql = createTableSql(collection);
				await pool.query(createSql);
			}
		},

		async find(
			collection: string,
			queryParams: Record<string, unknown>,
		): Promise<Record<string, unknown>[]> {
			const limitValue = typeof queryParams['limit'] === 'number' ? queryParams['limit'] : 100;
			const pageValue = typeof queryParams['page'] === 'number' ? queryParams['page'] : 1;
			const offset = (pageValue - 1) * limitValue;

			return query(`SELECT * FROM "${collection}" LIMIT $1 OFFSET $2`, [limitValue, offset]);
		},

		async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
			return queryOne(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
		},

		async create(
			collection: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			const id = randomUUID();
			const now = new Date().toISOString();

			const doc: Record<string, unknown> = {
				...data,
				id,
				createdAt: now,
				updatedAt: now,
			};

			const columns = Object.keys(doc);
			const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
			const values = columns.map((col) => {
				const val = doc[col];
				// Handle undefined
				if (val === undefined) {
					return null;
				}
				// Serialize objects/arrays as JSON (PostgreSQL will handle JSONB conversion)
				if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
					return JSON.stringify(val);
				}
				return val;
			});

			const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
			await pool.query(
				`INSERT INTO "${collection}" (${quotedColumns}) VALUES (${placeholders})`,
				values,
			);

			return doc;
		},

		async update(
			collection: string,
			id: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			const now = new Date().toISOString();
			const updateData: Record<string, unknown> = { ...data, updatedAt: now };

			// Remove id and createdAt from update data if present
			delete updateData['id'];
			delete updateData['createdAt'];

			const setClauses: string[] = [];
			const values: unknown[] = [];
			let paramIndex = 1;

			for (const [key, value] of Object.entries(updateData)) {
				setClauses.push(`"${key}" = $${paramIndex}`);
				paramIndex++;
				// Handle undefined
				if (value === undefined) {
					values.push(null);
				} else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
					values.push(JSON.stringify(value));
				} else {
					values.push(value);
				}
			}
			values.push(id);

			await pool.query(
				`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
				values,
			);

			// Fetch and return the updated document
			const updated = await queryOne<Record<string, unknown>>(
				`SELECT * FROM "${collection}" WHERE id = $1`,
				[id],
			);
			if (!updated) {
				throw new Error('Failed to fetch updated document');
			}
			return updated;
		},

		async delete(collection: string, id: string): Promise<boolean> {
			const rowCount = await execute(`DELETE FROM "${collection}" WHERE id = $1`, [id]);
			return rowCount > 0;
		},
	};
}

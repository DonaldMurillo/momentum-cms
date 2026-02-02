import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseAdapter, CollectionConfig, Field } from '@momentum-cms/core';

/**
 * Type guard to check if a value is a record object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Simple async queue to serialize database operations.
 * Prevents SQLite locking issues with concurrent requests.
 */
class AsyncQueue {
	private queue: Promise<unknown> = Promise.resolve();

	/**
	 * Add an operation to the queue. Operations execute sequentially.
	 */
	enqueue<T>(operation: () => T): Promise<T> {
		const result = this.queue.then(() => operation());
		// Update queue to wait for this operation (ignore errors for queue chaining)
		this.queue = result.catch(() => undefined);
		return result;
	}
}

// Note: drizzle-orm is available for advanced type-safe queries:
// import { drizzle } from 'drizzle-orm/better-sqlite3';
// const db = drizzle(sqlite);

/**
 * SQLite adapter options.
 */
export interface SqliteAdapterOptions {
	/**
	 * Path to SQLite database file.
	 * Use ':memory:' for in-memory database.
	 */
	filename: string;
}

/**
 * Maps field types to SQLite column types.
 */
function getColumnType(field: Field): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'slug':
		case 'select':
			return 'TEXT';
		case 'number':
			return 'REAL';
		case 'checkbox':
			return 'INTEGER'; // SQLite uses 0/1 for boolean
		case 'date':
			return 'TEXT'; // ISO date string
		case 'relationship':
			return 'TEXT'; // Store as ID reference
		case 'array':
		case 'group':
		case 'blocks':
		case 'json':
			return 'TEXT'; // JSON string
		default:
			return 'TEXT';
	}
}

/**
 * Creates the SQL for a collection's table.
 */
function createTableSql(collection: CollectionConfig): string {
	const columns: string[] = [
		'id TEXT PRIMARY KEY',
		'createdAt TEXT NOT NULL',
		'updatedAt TEXT NOT NULL',
	];

	for (const field of collection.fields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	return `CREATE TABLE IF NOT EXISTS "${collection.slug}" (${columns.join(', ')})`;
}

/**
 * Ensures the parent directory exists for a file path.
 */
function ensureDirectoryExists(filePath: string): void {
	// Skip for in-memory database
	if (filePath === ':memory:') {
		return;
	}

	const dir = dirname(filePath);
	if (dir && dir !== '.' && !existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * SQL statements to create Better Auth required tables.
 * These tables must exist before Better Auth can function.
 */
const AUTH_TABLES_SQL = `
	CREATE TABLE IF NOT EXISTS "user" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"name" TEXT NOT NULL,
		"email" TEXT NOT NULL UNIQUE,
		"emailVerified" INTEGER NOT NULL DEFAULT 0,
		"image" TEXT,
		"role" TEXT NOT NULL DEFAULT 'user',
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS "session" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"userId" TEXT NOT NULL,
		"token" TEXT NOT NULL UNIQUE,
		"expiresAt" TEXT NOT NULL,
		"ipAddress" TEXT,
		"userAgent" TEXT,
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL,
		FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS "account" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"userId" TEXT NOT NULL,
		"accountId" TEXT NOT NULL,
		"providerId" TEXT NOT NULL,
		"accessToken" TEXT,
		"refreshToken" TEXT,
		"accessTokenExpiresAt" TEXT,
		"refreshTokenExpiresAt" TEXT,
		"scope" TEXT,
		"idToken" TEXT,
		"password" TEXT,
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL,
		FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS "verification" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"identifier" TEXT NOT NULL,
		"value" TEXT NOT NULL,
		"expiresAt" TEXT NOT NULL,
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");
	CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session"("token");
	CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
	CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
`;

/**
 * Extended adapter interface that includes raw database access for Better Auth.
 */
export interface SqliteAdapterWithRaw extends DatabaseAdapter {
	/** Get the raw better-sqlite3 database instance for Better Auth integration */
	getRawDatabase(): Database.Database;
}

/**
 * Creates a SQLite database adapter using Drizzle ORM.
 */
export function sqliteAdapter(options: SqliteAdapterOptions): SqliteAdapterWithRaw {
	// Ensure the parent directory exists before creating the database
	ensureDirectoryExists(options.filename);

	const sqlite = new Database(options.filename);
	// Enable WAL mode for better concurrent read performance
	sqlite.pragma('journal_mode = WAL');

	// Queue for serializing write operations
	const writeQueue = new AsyncQueue();

	return {
		/**
		 * Get the raw better-sqlite3 database instance for Better Auth integration.
		 */
		getRawDatabase(): Database.Database {
			return sqlite;
		},

		async initialize(collections: CollectionConfig[]): Promise<void> {
			// Create Better Auth tables first
			// Note: Using better-sqlite3's exec() method which is safe for SQL strings
			sqlite.exec(AUTH_TABLES_SQL);

			// Then create collection tables
			for (const collection of collections) {
				const createSql = createTableSql(collection);
				sqlite.exec(createSql);
			}
		},

		async find(
			collection: string,
			query: Record<string, unknown>,
		): Promise<Record<string, unknown>[]> {
			const limitValue = typeof query['limit'] === 'number' ? query['limit'] : 100;
			const pageValue = typeof query['page'] === 'number' ? query['page'] : 1;
			const offset = (pageValue - 1) * limitValue;

			// Use better-sqlite3 directly for SELECT queries
			const rows: unknown[] = sqlite
				.prepare(`SELECT * FROM "${collection}" LIMIT ? OFFSET ?`)
				.all(limitValue, offset);
			return rows.filter(
				(row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
			);
		},

		async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
			const row: unknown = sqlite.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(id);
			return isRecord(row) ? row : null;
		},

		async create(
			collection: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			return writeQueue.enqueue(() => {
				const id = randomUUID();
				const now = new Date().toISOString();

				const doc: Record<string, unknown> = {
					...data,
					id,
					createdAt: now,
					updatedAt: now,
				};

				const columns = Object.keys(doc);
				const placeholders = columns.map(() => '?').join(', ');
				const values = columns.map((col) => {
					const val = doc[col];
					// Handle undefined - SQLite can't bind undefined
					if (val === undefined) {
						return null;
					}
					// Handle booleans - SQLite uses 0/1
					if (typeof val === 'boolean') {
						return val ? 1 : 0;
					}
					// Serialize objects/arrays as JSON
					if (typeof val === 'object' && val !== null) {
						return JSON.stringify(val);
					}
					return val;
				});

				const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
				sqlite
					.prepare(`INSERT INTO "${collection}" (${quotedColumns}) VALUES (${placeholders})`)
					.run(...values);

				return doc;
			});
		},

		async update(
			collection: string,
			id: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			return writeQueue.enqueue(() => {
				const now = new Date().toISOString();
				const updateData: Record<string, unknown> = { ...data, updatedAt: now };

				// Remove id and createdAt from update data if present
				delete updateData['id'];
				delete updateData['createdAt'];

				const setClauses: string[] = [];
				const values: unknown[] = [];

				for (const [key, value] of Object.entries(updateData)) {
					setClauses.push(`"${key}" = ?`);
					// Handle undefined - SQLite can't bind undefined
					if (value === undefined) {
						values.push(null);
					} else if (typeof value === 'boolean') {
						// Handle booleans - SQLite uses 0/1
						values.push(value ? 1 : 0);
					} else if (typeof value === 'object' && value !== null) {
						values.push(JSON.stringify(value));
					} else {
						values.push(value);
					}
				}
				values.push(id);

				sqlite
					.prepare(`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE id = ?`)
					.run(...values);

				// Fetch and return the updated document
				const updated: unknown = sqlite
					.prepare(`SELECT * FROM "${collection}" WHERE id = ?`)
					.get(id);
				if (!isRecord(updated)) {
					throw new Error('Failed to fetch updated document');
				}
				return updated;
			});
		},

		async delete(collection: string, id: string): Promise<boolean> {
			return writeQueue.enqueue(() => {
				const result = sqlite.prepare(`DELETE FROM "${collection}" WHERE id = ?`).run(id);
				return result.changes > 0;
			});
		},
	};
}

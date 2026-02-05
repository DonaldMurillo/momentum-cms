import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
	DatabaseAdapter,
	CollectionConfig,
	Field,
	DocumentVersion,
	DocumentStatus,
	VersionQueryOptions,
	VersionCountOptions,
	CreateVersionOptions,
} from '@momentum-cms/core';

/**
 * Type guard to check if a value is a record object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is a valid DocumentStatus.
 */
function isDocumentStatus(value: unknown): value is DocumentStatus {
	return value === 'draft' || value === 'published';
}

/**
 * Safely get DocumentStatus from a row value.
 */
function getStatusFromRow(row: Record<string, unknown>): DocumentStatus {
	const status = row['_status'];
	if (isDocumentStatus(status)) {
		return status;
	}
	return 'draft'; // Default fallback
}

/**
 * Safely parse JSON to Record<string, unknown>.
 */
function parseJsonToRecord(jsonString: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(jsonString);
		if (isRecord(parsed)) {
			return parsed;
		}
		return {};
	} catch {
		return {};
	}
}

/**
 * Validates that a collection slug is safe for use in SQL.
 * Prevents potential SQL injection via table names.
 */
function validateCollectionSlug(slug: string): void {
	const validSlug = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
	if (!validSlug.test(slug)) {
		throw new Error(
			`Invalid collection slug: "${slug}". Slugs must start with a letter or underscore and contain only alphanumeric characters, underscores, and hyphens.`,
		);
	}
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
		case 'upload':
			return 'TEXT'; // Store as ID reference to media document
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

	// Add _status column for versioned collections with drafts enabled
	if (hasVersionDrafts(collection)) {
		columns.push('"_status" TEXT NOT NULL DEFAULT \'draft\'');
	}

	for (const field of collection.fields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	return `CREATE TABLE IF NOT EXISTS "${collection.slug}" (${columns.join(', ')})`;
}

/**
 * Check if a collection has versioning with drafts enabled.
 */
function hasVersionDrafts(collection: CollectionConfig): boolean {
	if (!collection.versions) {
		return false;
	}
	if (collection.versions === true) {
		return true; // versions: true implies drafts enabled
	}
	return !!collection.versions.drafts;
}

/**
 * Creates the SQL for a collection's versions table.
 * Returns null if versioning is not enabled for the collection.
 */
function createVersionTableSql(collection: CollectionConfig): string | null {
	if (!collection.versions) {
		return null;
	}

	const tableName = `${collection.slug}_versions`;
	return `
		CREATE TABLE IF NOT EXISTS "${tableName}" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"parent" TEXT NOT NULL,
			"version" TEXT NOT NULL,
			"_status" TEXT NOT NULL DEFAULT 'draft',
			"autosave" INTEGER NOT NULL DEFAULT 0,
			"publishedAt" TEXT,
			"createdAt" TEXT NOT NULL,
			"updatedAt" TEXT NOT NULL,
			FOREIGN KEY ("parent") REFERENCES "${collection.slug}"("id") ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS "idx_${tableName}_parent" ON "${tableName}"("parent");
		CREATE INDEX IF NOT EXISTS "idx_${tableName}_status" ON "${tableName}"("_status");
		CREATE INDEX IF NOT EXISTS "idx_${tableName}_createdAt" ON "${tableName}"("createdAt");
	`;
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
 * SQL statements to create seed tracking table.
 * Used to track seeded entities for idempotent seeding.
 */
const SEED_TRACKING_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS "_momentum_seeds" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"seedId" TEXT NOT NULL UNIQUE,
		"collection" TEXT NOT NULL,
		"documentId" TEXT NOT NULL,
		"checksum" TEXT NOT NULL,
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_momentum_seeds_seedId" ON "_momentum_seeds"("seedId");
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
			// Note: Using better-sqlite3's method which is safe for SQL strings
			sqlite.exec(AUTH_TABLES_SQL);

			// Create seed tracking table for idempotent seeding
			sqlite.exec(SEED_TRACKING_TABLE_SQL);

			// Then create collection tables and version tables
			for (const collection of collections) {
				// Create main collection table
				const createSql = createTableSql(collection);
				sqlite.exec(createSql);

				// Create versions table for versioned collections
				const versionTableSql = createVersionTableSql(collection);
				if (versionTableSql) {
					sqlite.exec(versionTableSql);
				}
			}
		},

		async find(
			collection: string,
			query: Record<string, unknown>,
		): Promise<Record<string, unknown>[]> {
			validateCollectionSlug(collection);
			const limitValue = typeof query['limit'] === 'number' ? query['limit'] : 100;
			const pageValue = typeof query['page'] === 'number' ? query['page'] : 1;
			const offset = (pageValue - 1) * limitValue;

			// Build WHERE clause from query parameters (excluding pagination params)
			const whereClauses: string[] = [];
			const whereValues: unknown[] = [];
			const reservedParams = new Set(['limit', 'page', 'sort', 'order']);

			// Regex to validate column names (alphanumeric and underscore only, must start with letter or underscore)
			const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

			for (const [key, value] of Object.entries(query)) {
				if (reservedParams.has(key)) {
					continue;
				}
				if (value !== undefined && value !== null) {
					// Validate column name to prevent SQL injection
					if (!validColumnName.test(key)) {
						throw new Error(`Invalid column name: ${key}`);
					}
					whereClauses.push(`"${key}" = ?`);
					whereValues.push(value);
				}
			}

			const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

			// Use better-sqlite3 directly for SELECT queries
			const sql = `SELECT * FROM "${collection}" ${whereClause} LIMIT ? OFFSET ?`;
			const rows: unknown[] = sqlite.prepare(sql).all(...whereValues, limitValue, offset);
			return rows.filter(
				(row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
			);
		},

		async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
			validateCollectionSlug(collection);
			const row: unknown = sqlite.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(id);
			return isRecord(row) ? row : null;
		},

		async create(
			collection: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			validateCollectionSlug(collection);
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
			validateCollectionSlug(collection);
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
			validateCollectionSlug(collection);
			return writeQueue.enqueue(() => {
				const result = sqlite.prepare(`DELETE FROM "${collection}" WHERE id = ?`).run(id);
				return result.changes > 0;
			});
		},

		// ============================================
		// Version Operations
		// ============================================

		async createVersion(
			collection: string,
			parentId: string,
			data: Record<string, unknown>,
			options?: CreateVersionOptions,
		): Promise<DocumentVersion> {
			validateCollectionSlug(collection);
			return writeQueue.enqueue(() => {
				const id = randomUUID();
				const now = new Date().toISOString();
				const tableName = `${collection}_versions`;
				const status: DocumentStatus = options?.status ?? 'draft';
				const autosave = options?.autosave ? 1 : 0;

				const doc: DocumentVersion = {
					id,
					parent: parentId,
					version: JSON.stringify(data),
					_status: status,
					autosave: autosave === 1,
					publishedAt: status === 'published' ? now : undefined,
					createdAt: now,
					updatedAt: now,
				};

				sqlite
					.prepare(
						`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "publishedAt", "createdAt", "updatedAt")
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.run(
						doc.id,
						doc.parent,
						doc.version,
						doc._status,
						autosave,
						doc.publishedAt ?? null,
						doc.createdAt,
						doc.updatedAt,
					);

				return doc;
			});
		},

		async findVersions(
			collection: string,
			parentId: string,
			options?: VersionQueryOptions,
		): Promise<DocumentVersion[]> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;
			const limit = options?.limit ?? 10;
			const page = options?.page ?? 1;
			const offset = (page - 1) * limit;
			const sortOrder = options?.sort === 'asc' ? 'ASC' : 'DESC';

			// Build WHERE clauses
			const whereClauses: string[] = ['"parent" = ?'];
			const whereValues: unknown[] = [parentId];

			if (!options?.includeAutosave) {
				whereClauses.push('"autosave" = 0');
			}

			if (options?.status) {
				whereClauses.push('"_status" = ?');
				whereValues.push(options.status);
			}

			const whereClause = whereClauses.join(' AND ');

			const sql = `SELECT * FROM "${tableName}" WHERE ${whereClause} ORDER BY "createdAt" ${sortOrder} LIMIT ? OFFSET ?`;
			const rows = sqlite.prepare(sql).all(...whereValues, limit, offset);

			return rows.filter(isRecord).map((row) => ({
				id: String(row['id']),
				parent: String(row['parent']),
				version: String(row['version']),
				_status: getStatusFromRow(row),
				autosave: row['autosave'] === 1,
				publishedAt: row['publishedAt'] ? String(row['publishedAt']) : undefined,
				createdAt: String(row['createdAt']),
				updatedAt: String(row['updatedAt']),
			}));
		},

		async findVersionById(collection: string, versionId: string): Promise<DocumentVersion | null> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;
			const row: unknown = sqlite
				.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ?`)
				.get(versionId);

			if (!isRecord(row)) {
				return null;
			}

			return {
				id: String(row['id']),
				parent: String(row['parent']),
				version: String(row['version']),
				_status: getStatusFromRow(row),
				autosave: row['autosave'] === 1,
				publishedAt: row['publishedAt'] ? String(row['publishedAt']) : undefined,
				createdAt: String(row['createdAt']),
				updatedAt: String(row['updatedAt']),
			};
		},

		async restoreVersion(collection: string, versionId: string): Promise<Record<string, unknown>> {
			validateCollectionSlug(collection);
			return writeQueue.enqueue(() => {
				const tableName = `${collection}_versions`;

				// Get the version to restore
				const versionRow: unknown = sqlite
					.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ?`)
					.get(versionId);

				if (!isRecord(versionRow)) {
					throw new Error(`Version "${versionId}" not found in collection "${collection}"`);
				}

				const parentId = String(versionRow['parent']);
				const versionData = parseJsonToRecord(String(versionRow['version']));
				const originalStatus = getStatusFromRow(versionRow);
				const now = new Date().toISOString();

				// Update the main document with version data
				const setClauses: string[] = [];
				const values: unknown[] = [];

				for (const [key, value] of Object.entries(versionData)) {
					if (key === 'id' || key === 'createdAt') continue;
					setClauses.push(`"${key}" = ?`);
					if (value === undefined) {
						values.push(null);
					} else if (typeof value === 'boolean') {
						values.push(value ? 1 : 0);
					} else if (typeof value === 'object' && value !== null) {
						values.push(JSON.stringify(value));
					} else {
						values.push(value);
					}
				}

				setClauses.push('"updatedAt" = ?');
				values.push(now);
				values.push(parentId);

				sqlite
					.prepare(`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE "id" = ?`)
					.run(...values);

				// Create a new version preserving the original status
				const newVersionId = randomUUID();
				sqlite
					.prepare(
						`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "createdAt", "updatedAt")
						 VALUES (?, ?, ?, ?, 0, ?, ?)`,
					)
					.run(newVersionId, parentId, String(versionRow['version']), originalStatus, now, now);

				// Return the updated document
				const updated: unknown = sqlite
					.prepare(`SELECT * FROM "${collection}" WHERE "id" = ?`)
					.get(parentId);

				if (!isRecord(updated)) {
					throw new Error('Failed to fetch restored document');
				}

				return updated;
			});
		},

		async deleteVersions(
			collection: string,
			parentId: string,
			keepLatest?: number,
		): Promise<number> {
			validateCollectionSlug(collection);
			return writeQueue.enqueue(() => {
				const tableName = `${collection}_versions`;

				if (keepLatest === undefined || keepLatest <= 0) {
					// Delete all versions for this parent
					const result = sqlite
						.prepare(`DELETE FROM "${tableName}" WHERE "parent" = ?`)
						.run(parentId);
					return result.changes;
				}

				// Keep the latest N versions, delete the rest
				// First, get the IDs to keep
				const keepIds = sqlite
					.prepare(
						`SELECT "id" FROM "${tableName}" WHERE "parent" = ? ORDER BY "createdAt" DESC LIMIT ?`,
					)
					.all(parentId, keepLatest)
					.filter(isRecord)
					.map((row) => String(row['id']));

				if (keepIds.length === 0) {
					return 0;
				}

				const placeholders = keepIds.map(() => '?').join(', ');
				const result = sqlite
					.prepare(
						`DELETE FROM "${tableName}" WHERE "parent" = ? AND "id" NOT IN (${placeholders})`,
					)
					.run(parentId, ...keepIds);

				return result.changes;
			});
		},

		async countVersions(
			collection: string,
			parentId: string,
			options?: VersionCountOptions,
		): Promise<number> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;

			const whereClauses: string[] = ['"parent" = ?'];
			const whereValues: unknown[] = [parentId];

			if (!options?.includeAutosave) {
				whereClauses.push('"autosave" = 0');
			}

			if (options?.status) {
				whereClauses.push('"_status" = ?');
				whereValues.push(options.status);
			}

			const whereClause = whereClauses.join(' AND ');
			const result = sqlite
				.prepare(`SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`)
				.get(...whereValues);

			if (isRecord(result) && typeof result['count'] === 'number') {
				return result['count'];
			}
			return 0;
		},

		async updateStatus(collection: string, id: string, status: DocumentStatus): Promise<void> {
			validateCollectionSlug(collection);
			return writeQueue.enqueue(() => {
				const now = new Date().toISOString();
				sqlite
					.prepare(`UPDATE "${collection}" SET "_status" = ?, "updatedAt" = ? WHERE "id" = ?`)
					.run(status, now, id);
			});
		},
	};
}

import { Pool, type QueryResult } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
	DatabaseAdapter,
	CollectionConfig,
	Field,
	DocumentVersion,
	DocumentStatus,
	CreateVersionOptions,
	VersionQueryOptions,
	VersionCountOptions,
} from '@momentum-cms/core';

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

	// Add _status column for versioned collections with drafts
	if (hasVersionDrafts(collection)) {
		columns.push('"_status" VARCHAR(20) DEFAULT \'draft\'');
	}

	for (const field of collection.fields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	return `CREATE TABLE IF NOT EXISTS "${collection.slug}" (${columns.join(', ')})`;
}

/**
 * Check if a collection has version drafts enabled.
 */
function hasVersionDrafts(collection: CollectionConfig): boolean {
	const versions = collection.versions;
	if (!versions) return false;
	if (typeof versions === 'boolean') return false;
	return !!versions.drafts;
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
 * Creates the SQL for a collection's versions table.
 * Returns null if the collection doesn't have versioning enabled.
 */
function createVersionTableSql(collection: CollectionConfig): string | null {
	if (!collection.versions) return null;

	const tableName = `${collection.slug}_versions`;
	return `
		CREATE TABLE IF NOT EXISTS "${tableName}" (
			"id" VARCHAR(36) PRIMARY KEY,
			"parent" VARCHAR(36) NOT NULL,
			"version" TEXT NOT NULL,
			"_status" VARCHAR(20) DEFAULT 'draft',
			"autosave" BOOLEAN DEFAULT false,
			"publishedAt" TIMESTAMPTZ,
			"createdAt" TIMESTAMPTZ NOT NULL,
			"updatedAt" TIMESTAMPTZ NOT NULL,
			CONSTRAINT "fk_${tableName}_parent" FOREIGN KEY ("parent") REFERENCES "${collection.slug}"("id") ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS "idx_${tableName}_parent" ON "${tableName}"("parent");
		CREATE INDEX IF NOT EXISTS "idx_${tableName}_createdAt" ON "${tableName}"("createdAt");
	`;
}

/**
 * Type guard for DocumentStatus.
 */
function isDocumentStatus(value: unknown): value is DocumentStatus {
	return value === 'draft' || value === 'published';
}

/**
 * Safely extract status from a database row.
 */
function getStatusFromRow(row: Record<string, unknown>): DocumentStatus {
	const status = row['_status'];
	return isDocumentStatus(status) ? status : 'draft';
}

/**
 * Parse JSON string to Record, with error handling.
 */
function parseJsonToRecord(jsonString: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(jsonString);
		if (typeof parsed === 'object' && parsed !== null) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Safe after type check
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
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
 * SQL statements to create seed tracking table.
 * Used to track seeded entities for idempotent seeding.
 */
const SEED_TRACKING_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS "_momentum_seeds" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"seedId" VARCHAR(255) NOT NULL UNIQUE,
		"collection" VARCHAR(255) NOT NULL,
		"documentId" VARCHAR(36) NOT NULL,
		"checksum" VARCHAR(64) NOT NULL,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_momentum_seeds_seedId" ON "_momentum_seeds"("seedId");
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

			// Create seed tracking table for idempotent seeding
			await pool.query(SEED_TRACKING_TABLE_SQL);

			// Then create collection tables and version tables
			for (const collection of collections) {
				const createSql = createTableSql(collection);
				await pool.query(createSql);

				// Create versions table for versioned collections
				const versionTableSql = createVersionTableSql(collection);
				if (versionTableSql) {
					await pool.query(versionTableSql);
				}
			}
		},

		async find(
			collection: string,
			queryParams: Record<string, unknown>,
		): Promise<Record<string, unknown>[]> {
			const limitValue = typeof queryParams['limit'] === 'number' ? queryParams['limit'] : 100;
			const pageValue = typeof queryParams['page'] === 'number' ? queryParams['page'] : 1;
			const offset = (pageValue - 1) * limitValue;

			// Build WHERE clause from query parameters (excluding pagination params)
			const whereClauses: string[] = [];
			const whereValues: unknown[] = [];
			const reservedParams = new Set(['limit', 'page', 'sort', 'order']);
			let paramIndex = 1;

			// Regex to validate column names (alphanumeric and underscore only, must start with letter or underscore)
			const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

			for (const [key, value] of Object.entries(queryParams)) {
				if (reservedParams.has(key)) {
					continue;
				}
				if (value !== undefined && value !== null) {
					// Validate column name to prevent SQL injection
					if (!validColumnName.test(key)) {
						throw new Error(`Invalid column name: ${key}`);
					}
					whereClauses.push(`"${key}" = $${paramIndex}`);
					whereValues.push(value);
					paramIndex++;
				}
			}

			const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

			return query(
				`SELECT * FROM "${collection}" ${whereClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
				[...whereValues, limitValue, offset],
			);
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

		// ==========================================
		// Version Operations
		// ==========================================

		async createVersion(
			collection: string,
			parentId: string,
			data: Record<string, unknown>,
			options?: CreateVersionOptions,
		): Promise<DocumentVersion> {
			validateCollectionSlug(collection);
			const id = randomUUID();
			const now = new Date().toISOString();
			const status = options?.status ?? 'draft';
			const autosave = options?.autosave ?? false;
			const publishedAt = status === 'published' ? now : null;

			const versionData = JSON.stringify(data);
			const tableName = `${collection}_versions`;

			await pool.query(
				`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "publishedAt", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[id, parentId, versionData, status, autosave, publishedAt, now, now],
			);

			return {
				id,
				parent: parentId,
				version: versionData,
				_status: status,
				autosave,
				publishedAt: publishedAt ?? undefined,
				createdAt: now,
				updatedAt: now,
			};
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
			const sortDirection = options?.sort === 'asc' ? 'ASC' : 'DESC';

			const whereClauses: string[] = ['"parent" = $1'];
			const params: unknown[] = [parentId];
			let paramIndex = 2;

			if (!options?.includeAutosave) {
				whereClauses.push('"autosave" = false');
			}

			if (options?.status) {
				whereClauses.push(`"_status" = $${paramIndex}`);
				params.push(options.status);
				paramIndex++;
			}

			const whereClause = whereClauses.join(' AND ');
			params.push(limit, offset);

			const rows = await query<Record<string, unknown>>(
				`SELECT * FROM "${tableName}" WHERE ${whereClause} ORDER BY "createdAt" ${sortDirection} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
				params,
			);

			return rows.map((row) => ({
				id: String(row['id']),
				parent: String(row['parent']),
				version: String(row['version']),
				_status: getStatusFromRow(row),
				autosave: Boolean(row['autosave']),
				publishedAt: row['publishedAt'] ? String(row['publishedAt']) : undefined,
				createdAt: String(row['createdAt']),
				updatedAt: String(row['updatedAt']),
			}));
		},

		async findVersionById(collection: string, versionId: string): Promise<DocumentVersion | null> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;
			const row = await queryOne<Record<string, unknown>>(
				`SELECT * FROM "${tableName}" WHERE "id" = $1`,
				[versionId],
			);

			if (!row) return null;

			return {
				id: String(row['id']),
				parent: String(row['parent']),
				version: String(row['version']),
				_status: getStatusFromRow(row),
				autosave: Boolean(row['autosave']),
				publishedAt: row['publishedAt'] ? String(row['publishedAt']) : undefined,
				createdAt: String(row['createdAt']),
				updatedAt: String(row['updatedAt']),
			};
		},

		async restoreVersion(collection: string, versionId: string): Promise<Record<string, unknown>> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;

			// Get the version
			const version = await queryOne<Record<string, unknown>>(
				`SELECT * FROM "${tableName}" WHERE "id" = $1`,
				[versionId],
			);

			if (!version) {
				throw new Error('Version not found');
			}

			const parentId = String(version['parent']);
			const versionData = parseJsonToRecord(String(version['version']));
			const originalStatus = getStatusFromRow(version);

			// Update the main document with the version data
			const now = new Date().toISOString();
			const updateData: Record<string, unknown> = { ...versionData, updatedAt: now };

			// Remove id and createdAt from update data
			delete updateData['id'];
			delete updateData['createdAt'];

			const setClauses: string[] = [];
			const values: unknown[] = [];
			let paramIndex = 1;

			for (const [key, value] of Object.entries(updateData)) {
				setClauses.push(`"${key}" = $${paramIndex}`);
				paramIndex++;
				if (value === undefined) {
					values.push(null);
				} else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
					values.push(JSON.stringify(value));
				} else {
					values.push(value);
				}
			}
			values.push(parentId);

			await pool.query(
				`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex}`,
				values,
			);

			// Create a new version record preserving the original status
			const newVersionId = randomUUID();
			await pool.query(
				`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, false, $5, $6)`,
				[newVersionId, parentId, String(version['version']), originalStatus, now, now],
			);

			// Return the updated document
			const updated = await queryOne<Record<string, unknown>>(
				`SELECT * FROM "${collection}" WHERE "id" = $1`,
				[parentId],
			);

			if (!updated) {
				throw new Error('Failed to fetch restored document');
			}

			return updated;
		},

		async deleteVersions(
			collection: string,
			parentId: string,
			keepLatest?: number,
		): Promise<number> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;

			if (keepLatest && keepLatest > 0) {
				// Get IDs to keep
				const toKeep = await query<Record<string, unknown>>(
					`SELECT "id" FROM "${tableName}" WHERE "parent" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
					[parentId, keepLatest],
				);
				const keepIds = toKeep.map((r) => String(r['id']));

				if (keepIds.length === 0) {
					return 0;
				}

				const placeholders = keepIds.map((_, i) => `$${i + 2}`).join(', ');
				return execute(
					`DELETE FROM "${tableName}" WHERE "parent" = $1 AND "id" NOT IN (${placeholders})`,
					[parentId, ...keepIds],
				);
			}

			return execute(`DELETE FROM "${tableName}" WHERE "parent" = $1`, [parentId]);
		},

		async countVersions(
			collection: string,
			parentId: string,
			options?: VersionCountOptions,
		): Promise<number> {
			validateCollectionSlug(collection);
			const tableName = `${collection}_versions`;

			const whereClauses: string[] = ['"parent" = $1'];
			const params: unknown[] = [parentId];

			if (!options?.includeAutosave) {
				whereClauses.push('"autosave" = false');
			}

			if (options?.status) {
				whereClauses.push(`"_status" = $${params.length + 1}`);
				params.push(options.status);
			}

			const whereClause = whereClauses.join(' AND ');
			const result = await queryOne<Record<string, unknown>>(
				`SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`,
				params,
			);
			return Number(result?.['count'] ?? 0);
		},

		async updateStatus(collection: string, id: string, status: DocumentStatus): Promise<void> {
			validateCollectionSlug(collection);
			const now = new Date().toISOString();
			await pool.query(
				`UPDATE "${collection}" SET "_status" = $1, "updatedAt" = $2 WHERE "id" = $3`,
				[status, now, id],
			);
		},
	};
}

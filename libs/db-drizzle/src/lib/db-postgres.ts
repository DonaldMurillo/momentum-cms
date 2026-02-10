import { Pool, Client, type QueryResult } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
	DatabaseAdapter,
	CollectionConfig,
	GlobalConfig,
	Field,
	RelationshipField,
	OnDeleteAction,
	DocumentVersion,
	DocumentStatus,
	CreateVersionOptions,
	VersionQueryOptions,
	VersionCountOptions,
} from '@momentum-cms/core';
import { flattenDataFields, ReferentialIntegrityError } from '@momentum-cms/core';
import { createLogger } from '@momentum-cms/logger';

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
		case 'password':
		case 'radio':
		case 'point':
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
		case 'upload':
			return 'VARCHAR(36)'; // Store as ID reference to media document
		case 'array':
		case 'group':
		case 'blocks':
		case 'json':
			return 'JSONB';
		case 'tabs':
		case 'collapsible':
		case 'row':
			// Layout fields should be filtered out by flattenDataFields() before reaching here.
			// If they somehow arrive, return TEXT as a safe fallback.
			return 'TEXT';
		default:
			return 'TEXT';
	}
}

/**
 * Resolves the target collection slug from a relationship field's lazy reference.
 */
function resolveRelationshipSlug(field: RelationshipField): string | undefined {
	try {
		const config = field.collection();
		if (config && typeof config === 'object' && 'slug' in config) {
			const { slug } = config;
			if (typeof slug === 'string') return slug;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

/**
 * Maps onDelete option to SQL FK constraint clause.
 * When the column is NOT NULL (required), 'set-null' is impossible —
 * PostgreSQL would error trying to nullify a NOT NULL column.
 * In that case, we override to RESTRICT (block the delete).
 */
function mapOnDelete(onDelete: OnDeleteAction | undefined, required: boolean): string {
	const effective = required && (!onDelete || onDelete === 'set-null') ? 'restrict' : onDelete;
	switch (effective) {
		case 'restrict':
			return 'ON DELETE RESTRICT';
		case 'cascade':
			return 'ON DELETE CASCADE';
		default:
			return 'ON DELETE SET NULL';
	}
}

/**
 * Checks if an error is a PostgreSQL FK violation (code 23503) and throws
 * a ReferentialIntegrityError if so. This provides a clean HTTP 409 response.
 */
function rethrowIfFkViolation(error: unknown, table: string): void {
	if (error instanceof Error && 'code' in error && 'constraint' in error) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg library error properties
		const { code, constraint } = error as Error & { code: string; constraint: string };
		if (code === '23503') {
			throw new ReferentialIntegrityError(table, constraint);
		}
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

	// Add _status and scheduledPublishAt columns for versioned collections with drafts
	if (hasVersionDrafts(collection)) {
		columns.push('"_status" VARCHAR(20) DEFAULT \'draft\'');
		columns.push('"scheduledPublishAt" TIMESTAMPTZ');
	}

	// Flatten through layout fields (tabs, collapsible, row) to get only data fields
	const dataFields = flattenDataFields(collection.fields);
	for (const field of dataFields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	// FK constraints are added in a separate pass in initialize() after all tables exist
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

	-- Two-factor authentication support (Better Auth twoFactor plugin)
	ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false;

	CREATE TABLE IF NOT EXISTS "twoFactor" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"secret" TEXT NOT NULL,
		"backupCodes" TEXT NOT NULL,
		"userId" VARCHAR(36) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");
	CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session"("token");
	CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
	CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
	CREATE INDEX IF NOT EXISTS "idx_twofactor_secret" ON "twoFactor"("secret");
	CREATE INDEX IF NOT EXISTS "idx_twofactor_userId" ON "twoFactor"("userId");

	-- API keys table
	CREATE TABLE IF NOT EXISTS "_api_keys" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"name" VARCHAR(255) NOT NULL,
		"keyHash" VARCHAR(64) NOT NULL UNIQUE,
		"keyPrefix" VARCHAR(20) NOT NULL,
		"createdBy" VARCHAR(36) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
		"role" VARCHAR(50) NOT NULL DEFAULT 'user',
		"expiresAt" TIMESTAMPTZ,
		"lastUsedAt" TIMESTAMPTZ,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_api_keys_keyHash" ON "_api_keys"("keyHash");
	CREATE INDEX IF NOT EXISTS "idx_api_keys_createdBy" ON "_api_keys"("createdBy");
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
 * Query helpers type returned by createHelpers.
 */
interface QueryHelpers {
	query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	queryOne<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
	execute(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * Extracts the database name from a PostgreSQL connection string.
 */
function extractDatabaseName(connectionString: string): string | null {
	try {
		const url = new URL(connectionString);
		const dbName = url.pathname.slice(1); // Remove leading '/'
		return dbName || null;
	} catch {
		// Fallback: regex match for non-URL formats
		const match = connectionString.match(/\/([^/?]+)(\?|$)/);
		return match?.[1] ?? null;
	}
}

/**
 * Ensures the target database exists, creating it if necessary.
 * Uses a temporary connection to the default 'postgres' database for creation.
 *
 * @param connectionString - The full PostgreSQL connection string
 */
async function ensureDatabaseExists(connectionString: string): Promise<void> {
	const dbName = extractDatabaseName(connectionString);
	if (!dbName) {
		return; // Can't determine database name, let it fail naturally
	}

	// Try connecting to the target database
	const testClient = new Client({ connectionString });
	try {
		await testClient.connect();
		await testClient.end();
		return; // Database exists, all good
	} catch (error: unknown) {
		await testClient.end().catch(() => {
			/* ignore cleanup errors */
		});

		// Check if error is "database does not exist" (PostgreSQL error code 3D000)
		const pgError = error instanceof Object && 'code' in error ? error : null;
		if (!pgError || pgError.code !== '3D000') {
			throw error; // Some other connection error, rethrow
		}
	}

	// Database doesn't exist - create it via the default 'postgres' database
	// Use URL parsing to safely replace the database name
	let adminConnString: string;
	try {
		const url = new URL(connectionString);
		url.pathname = '/postgres';
		adminConnString = url.toString();
	} catch {
		// Fallback for non-URL connection strings
		adminConnString = connectionString.replace(`/${dbName}`, '/postgres');
	}
	const adminClient = new Client({ connectionString: adminConnString });

	try {
		await adminClient.connect();
		// Use double quotes to handle names with special characters
		const safeName = dbName.replace(/"/g, '""');
		await adminClient.query(`CREATE DATABASE "${safeName}"`);

		createLogger('DB').info(`Created database "${dbName}"`);
	} catch (createError: unknown) {
		// Handle race condition: another process may have created it concurrently
		const pgCreateError =
			createError instanceof Object && 'code' in createError ? createError : null;
		if (pgCreateError && pgCreateError.code === '42P04') {
			// 42P04 = "database already exists" — safe to ignore
			return;
		}
		throw createError;
	} finally {
		await adminClient.end();
	}
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
	 * Create query helpers scoped to a database connection.
	 * Used for both pool-level and client-level (transactional) queries.
	 */
	function createHelpers(conn: {
		query(text: string, values?: unknown[]): Promise<QueryResult>;
	}): QueryHelpers {
		async function query<T extends Record<string, unknown>>(
			sql: string,
			params: unknown[] = [],
		): Promise<T[]> {
			const result: QueryResult = await conn.query(sql, params);
			return result.rows.filter((row): row is T => typeof row === 'object' && row !== null);
		}

		async function queryOne<T extends Record<string, unknown>>(
			sql: string,
			params: unknown[] = [],
		): Promise<T | null> {
			const rows = await query<T>(sql, params);
			return rows[0] ?? null;
		}

		async function execute(sql: string, params: unknown[] = []): Promise<number> {
			const result: QueryResult = await conn.query(sql, params);
			return result.rowCount ?? 0;
		}

		return { query, queryOne, execute };
	}

	/**
	 * Build all CRUD and version adapter methods from query helpers.
	 * This allows the same method implementations to be used for both
	 * pool-level and transaction-level (client-level) operations.
	 */
	function buildMethods(h: QueryHelpers): Omit<DatabaseAdapter, 'initialize' | 'transaction'> {
		return {
			async find(
				collection: string,
				queryParams: Record<string, unknown>,
			): Promise<Record<string, unknown>[]> {
				validateCollectionSlug(collection);
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

				// limit: 0 means "no limit" (return all rows for count queries)
				if (limitValue === 0) {
					return h.query(`SELECT * FROM "${collection}" ${whereClause}`, whereValues);
				}
				return h.query(
					`SELECT * FROM "${collection}" ${whereClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
					[...whereValues, limitValue, offset],
				);
			},

			async search(
				collection: string,
				searchQuery: string,
				fields: string[],
				options?: { limit?: number; page?: number },
			): Promise<Record<string, unknown>[]> {
				validateCollectionSlug(collection);
				if (!searchQuery || fields.length === 0) return [];

				const limitValue = options?.limit ?? 20;
				const pageValue = options?.page ?? 1;
				const offset = (pageValue - 1) * limitValue;

				// Validate field names
				const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
				for (const field of fields) {
					if (!validColumnName.test(field)) {
						throw new Error(`Invalid column name: ${field}`);
					}
				}

				// Build tsvector from the requested fields, coalescing to handle NULL
				const tsvectorParts = fields.map((f) => `coalesce("${f}"::text, '')`).join(" || ' ' || ");
				const tsvectorExpr = `to_tsvector('simple', ${tsvectorParts})`;
				const tsqueryExpr = `plainto_tsquery('simple', $1)`;

				// Rank by relevance, fall back to ILIKE for partial matches
				const ilikeClauses = fields.map((f, i) => `"${f}"::text ILIKE $${i + 2}`).join(' OR ');
				const escapedQuery = searchQuery.replace(/[%_\\]/g, '\\$&');
				const ilikePattern = `%${escapedQuery}%`;
				const ilikeParams = fields.map(() => ilikePattern);

				const sql = `
					SELECT *, ts_rank(${tsvectorExpr}, ${tsqueryExpr}) AS _search_rank
					FROM "${collection}"
					WHERE ${tsvectorExpr} @@ ${tsqueryExpr} OR ${ilikeClauses}
					ORDER BY _search_rank DESC
					LIMIT $${fields.length + 2} OFFSET $${fields.length + 3}
				`;

				const results = await h.query(sql, [searchQuery, ...ilikeParams, limitValue, offset]);

				// Remove internal ranking column
				return results.map((row) => {
					const { _search_rank, ...doc } = row;
					return doc;
				});
			},

			async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
				validateCollectionSlug(collection);
				return h.queryOne(`SELECT * FROM "${collection}" WHERE id = $1`, [id]);
			},

			async create(
				collection: string,
				data: Record<string, unknown>,
			): Promise<Record<string, unknown>> {
				validateCollectionSlug(collection);
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
				await h.execute(
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
				validateCollectionSlug(collection);
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

				await h.execute(
					`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
					values,
				);

				// Fetch and return the updated document
				const updated = await h.queryOne<Record<string, unknown>>(
					`SELECT * FROM "${collection}" WHERE id = $1`,
					[id],
				);
				if (!updated) {
					throw new Error('Failed to fetch updated document');
				}
				return updated;
			},

			async delete(collection: string, id: string): Promise<boolean> {
				validateCollectionSlug(collection);
				try {
					const rowCount = await h.execute(`DELETE FROM "${collection}" WHERE id = $1`, [id]);
					return rowCount > 0;
				} catch (error: unknown) {
					rethrowIfFkViolation(error, collection);
					throw error;
				}
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

				await h.execute(
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

				const rows = await h.query<Record<string, unknown>>(
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

			async findVersionById(
				collection: string,
				versionId: string,
			): Promise<DocumentVersion | null> {
				validateCollectionSlug(collection);
				const tableName = `${collection}_versions`;
				const row = await h.queryOne<Record<string, unknown>>(
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

			async restoreVersion(
				collection: string,
				versionId: string,
			): Promise<Record<string, unknown>> {
				validateCollectionSlug(collection);
				const tableName = `${collection}_versions`;

				// Get the version
				const version = await h.queryOne<Record<string, unknown>>(
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
				const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

				for (const [key, value] of Object.entries(updateData)) {
					if (!validColumnName.test(key)) {
						throw new Error(`Invalid column name in version data: ${key}`);
					}
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

				await h.execute(
					`UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex}`,
					values,
				);

				// Create a new version record preserving the original status
				const newVersionId = randomUUID();
				await h.execute(
					`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "createdAt", "updatedAt")
					 VALUES ($1, $2, $3, $4, false, $5, $6)`,
					[newVersionId, parentId, String(version['version']), originalStatus, now, now],
				);

				// Return the updated document
				const updated = await h.queryOne<Record<string, unknown>>(
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
					const toKeep = await h.query<Record<string, unknown>>(
						`SELECT "id" FROM "${tableName}" WHERE "parent" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
						[parentId, keepLatest],
					);
					const keepIds = toKeep.map((r) => String(r['id']));

					if (keepIds.length === 0) {
						return 0;
					}

					const placeholders = keepIds.map((_, i) => `$${i + 2}`).join(', ');
					return h.execute(
						`DELETE FROM "${tableName}" WHERE "parent" = $1 AND "id" NOT IN (${placeholders})`,
						[parentId, ...keepIds],
					);
				}

				return h.execute(`DELETE FROM "${tableName}" WHERE "parent" = $1`, [parentId]);
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
				const result = await h.queryOne<Record<string, unknown>>(
					`SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`,
					params,
				);
				return Number(result?.['count'] ?? 0);
			},

			async updateStatus(collection: string, id: string, status: DocumentStatus): Promise<void> {
				validateCollectionSlug(collection);
				const now = new Date().toISOString();
				await h.execute(
					`UPDATE "${collection}" SET "_status" = $1, "updatedAt" = $2 WHERE "id" = $3`,
					[status, now, id],
				);
			},

			async setScheduledPublishAt(
				collection: string,
				id: string,
				publishAt: string | null,
			): Promise<void> {
				validateCollectionSlug(collection);
				const now = new Date().toISOString();
				await h.execute(
					`UPDATE "${collection}" SET "scheduledPublishAt" = $1, "updatedAt" = $2 WHERE "id" = $3`,
					[publishAt, now, id],
				);
			},

			async findScheduledDocuments(
				collection: string,
				before: string,
			): Promise<Array<{ id: string; scheduledPublishAt: string }>> {
				validateCollectionSlug(collection);
				const rows = await h.query(
					`SELECT "id", "scheduledPublishAt" FROM "${collection}" WHERE "scheduledPublishAt" IS NOT NULL AND "scheduledPublishAt" <= $1`,
					[before],
				);
				return rows.map((row) => ({
					id: String(row['id']),
					scheduledPublishAt: String(row['scheduledPublishAt']),
				}));
			},
		};
	}

	// Create pool-scoped helpers and build adapter methods
	const helpers = createHelpers(pool);
	const methods = buildMethods(helpers);

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
		query: helpers.query,

		/**
		 * Execute a raw SQL query and return a single row.
		 */
		queryOne: helpers.queryOne,

		/**
		 * Execute a raw SQL statement.
		 */
		execute: helpers.execute,

		// Spread all CRUD + version methods
		...methods,

		async initialize(collections: CollectionConfig[]): Promise<void> {
			// Ensure database exists (auto-create if needed)
			await ensureDatabaseExists(options.connectionString);

			// Create Better Auth tables first
			await pool.query(AUTH_TABLES_SQL);

			// Create seed tracking table for idempotent seeding
			await pool.query(SEED_TRACKING_TABLE_SQL);

			// Then create collection tables and version tables
			for (const collection of collections) {
				const createSql = createTableSql(collection);
				await pool.query(createSql);

				// Ensure all field columns exist (handles tables created before new fields were added)
				const dataFields = flattenDataFields(collection.fields);
				for (const field of dataFields) {
					const colType = getColumnType(field);
					await pool.query(
						`ALTER TABLE "${collection.slug}" ADD COLUMN IF NOT EXISTS "${field.name}" ${colType}`,
					);
				}

				// Ensure versioning columns exist (handles tables created before versioning was enabled)
				if (hasVersionDrafts(collection)) {
					await pool.query(
						`ALTER TABLE "${collection.slug}" ADD COLUMN IF NOT EXISTS "_status" VARCHAR(20) DEFAULT 'draft'`,
					);
					await pool.query(
						`ALTER TABLE "${collection.slug}" ADD COLUMN IF NOT EXISTS "scheduledPublishAt" TIMESTAMPTZ`,
					);
				}

				// Create versions table for versioned collections
				const versionTableSql = createVersionTableSql(collection);
				if (versionTableSql) {
					await pool.query(versionTableSql);
				}
			}

			// Second pass: Add FK constraints for relationship fields
			// Done after all tables are created so target tables exist
			for (const collection of collections) {
				validateCollectionSlug(collection.slug);
				const dataFields = flattenDataFields(collection.fields);
				for (const field of dataFields) {
					if (field.type === 'relationship' && !field.hasMany && !field.relationTo) {
						const targetSlug = resolveRelationshipSlug(field);
						if (targetSlug) {
							validateCollectionSlug(targetSlug);
							validateCollectionSlug(field.name);
							const constraintName = `fk_${collection.slug}_${field.name}`;
							const isRequired = !!field.required;
							const onDeleteSql = mapOnDelete(field.onDelete, isRequired);

							// Clean up stale references before adding FK constraint.
							// Required (NOT NULL) columns can't be set to NULL, so delete the rows instead.
							if (isRequired) {
								await pool.query(
									`DELETE FROM "${collection.slug}" WHERE "${field.name}" IS NOT NULL AND "${field.name}" NOT IN (SELECT "id" FROM "${targetSlug}")`,
								);
							} else {
								await pool.query(
									`UPDATE "${collection.slug}" SET "${field.name}" = NULL WHERE "${field.name}" IS NOT NULL AND "${field.name}" NOT IN (SELECT "id" FROM "${targetSlug}")`,
								);
							}

							// Add FK constraint only if it doesn't exist
							await pool.query(`
								DO $$ BEGIN
									IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
										ALTER TABLE "${collection.slug}"
											ADD CONSTRAINT "${constraintName}"
											FOREIGN KEY ("${field.name}")
											REFERENCES "${targetSlug}"("id")
											${onDeleteSql};
									END IF;
								END $$;
							`);
						}
					}
				}
			}
		},

		// ============================================
		// Globals Support
		// ============================================

		async initializeGlobals(_globals: GlobalConfig[]): Promise<void> {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS "_globals" (
					"slug" VARCHAR(255) PRIMARY KEY,
					"data" JSONB NOT NULL DEFAULT '{}',
					"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
		},

		async findGlobal(slug: string): Promise<Record<string, unknown> | null> {
			const result: QueryResult = await pool.query('SELECT * FROM "_globals" WHERE "slug" = $1', [
				slug,
			]);
			if (result.rows.length === 0) return null;
			const row = result.rows[0];
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row is Record<string, unknown>
			const data = (
				typeof row['data'] === 'string' ? JSON.parse(row['data']) : row['data']
			) as Record<string, unknown>;
			return {
				...data,
				slug: row['slug'],
				createdAt: row['createdAt'],
				updatedAt: row['updatedAt'],
			};
		},

		async updateGlobal(
			slug: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			const now = new Date().toISOString();
			const jsonData = JSON.stringify(data);
			const result: QueryResult = await pool.query(
				`INSERT INTO "_globals" ("slug", "data", "createdAt", "updatedAt")
				 VALUES ($1, $2::jsonb, $3, $4)
				 ON CONFLICT ("slug") DO UPDATE SET "data" = $2::jsonb, "updatedAt" = $4
				 RETURNING *`,
				[slug, jsonData, now, now],
			);
			const row = result.rows[0];
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row is Record<string, unknown>
			const returned = (
				typeof row['data'] === 'string' ? JSON.parse(row['data']) : row['data']
			) as Record<string, unknown>;
			return {
				...returned,
				slug: row['slug'],
				createdAt: row['createdAt'],
				updatedAt: row['updatedAt'],
			};
		},

		async transaction<T>(callback: (txAdapter: DatabaseAdapter) => Promise<T>): Promise<T> {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				const txHelpers = createHelpers(client);
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- buildMethods returns all required DatabaseAdapter methods
				const txAdapter = buildMethods(txHelpers) as DatabaseAdapter;
				const result = await callback(txAdapter);
				await client.query('COMMIT');
				return result;
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		},
	};
}

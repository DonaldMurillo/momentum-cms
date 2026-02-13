import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
	DatabaseAdapter,
	CollectionConfig,
	GlobalConfig,
	Field,
	DocumentVersion,
	DocumentStatus,
	VersionQueryOptions,
	VersionCountOptions,
	CreateVersionOptions,
} from '@momentum-cms/core';
import { flattenDataFields, getSoftDeleteField } from '@momentum-cms/core';

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
 * Validates that a column name is safe for use in SQL.
 * Prevents SQL injection via column name interpolation.
 */
function validateColumnName(name: string): void {
	const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
	if (!validColumnName.test(name)) {
		throw new Error(`Invalid column name: "${name}"`);
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

	// Add soft-delete column
	const softDeleteCol = getSoftDeleteField(collection);
	if (softDeleteCol) {
		validateColumnName(softDeleteCol);
		columns.push(`"${softDeleteCol}" TEXT`);
	}

	const dataFields = flattenDataFields(collection.fields);
	for (const field of dataFields) {
		const colType = getColumnType(field);
		const notNull = field.required ? ' NOT NULL' : '';
		columns.push(`"${field.name}" ${colType}${notNull}`);
	}

	const tableName = collection.dbName ?? collection.slug;
	return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(', ')})`;
}

/**
 * Resolves the actual database table name for a collection.
 * Uses dbName if specified, falls back to slug.
 */
function getTableName(collection: CollectionConfig): string {
	return collection.dbName ?? collection.slug;
}

/**
 * Check if a collection has versioning with drafts enabled.
 */
function hasVersionDrafts(collection: CollectionConfig): boolean {
	const versions = collection.versions;
	if (!versions) return false;
	if (typeof versions === 'boolean') return false;
	return !!versions.drafts;
}

/**
 * Creates the SQL for a collection's versions table.
 * Returns null if versioning is not enabled for the collection.
 */
function createVersionTableSql(collection: CollectionConfig): string | null {
	if (!collection.versions) {
		return null;
	}

	const baseTable = getTableName(collection);
	const tableName = `${baseTable}_versions`;
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
			FOREIGN KEY ("parent") REFERENCES "${baseTable}"("id") ON DELETE CASCADE
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

// AUTH_TABLES_SQL removed — auth tables are now defined as managed collections
// and created through the normal createTableSql() path via the auth plugin.

/**
 * SQL statements to create seed tracking table.
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
 * Creates a SQLite database adapter using better-sqlite3.
 */
export function sqliteAdapter(options: SqliteAdapterOptions): SqliteAdapterWithRaw {
	ensureDirectoryExists(options.filename);

	const sqlite = new Database(options.filename);
	sqlite.pragma('journal_mode = WAL');

	const writeQueue = new AsyncQueue();

	/** Maps collection slugs to actual DB table names (populated during initialize). */
	const tableNameMap = new Map<string, string>();

	/**
	 * Resolves a collection slug to its actual database table name.
	 * Falls back to the slug itself if no mapping exists.
	 */
	function resolveTableName(slug: string): string {
		return tableNameMap.get(slug) ?? slug;
	}

	// ============================================
	// Sync implementations shared by normal and transactional adapters
	// ============================================

	function findSync(collection: string, query: Record<string, unknown>): Record<string, unknown>[] {
		validateCollectionSlug(collection);
		const limitValue = typeof query['limit'] === 'number' ? query['limit'] : 100;
		const pageValue = typeof query['page'] === 'number' ? query['page'] : 1;
		const offset = (pageValue - 1) * limitValue;

		const whereClauses: string[] = [];
		const whereValues: unknown[] = [];
		const reservedParams = new Set(['limit', 'page', 'sort', 'order']);
		const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

		for (const [key, value] of Object.entries(query)) {
			if (reservedParams.has(key)) continue;
			if (value === undefined) continue;
			if (!validColumnName.test(key)) {
				throw new Error(`Invalid column name: ${key}`);
			}
			if (value === null) {
				whereClauses.push(`"${key}" IS NULL`);
			} else if (
				typeof value === 'object' &&
				value !== null &&
				'$ne' in value &&
				value['$ne'] === null
			) {
				whereClauses.push(`"${key}" IS NOT NULL`);
			} else {
				whereClauses.push(`"${key}" = ?`);
				whereValues.push(value);
			}
		}

		const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
		// limit: 0 means "no limit" (return all rows for count queries)
		let rows: unknown[];
		if (limitValue === 0) {
			const sql = `SELECT * FROM "${resolveTableName(collection)}" ${whereClause}`;
			rows = sqlite.prepare(sql).all(...whereValues);
		} else {
			const sql = `SELECT * FROM "${resolveTableName(collection)}" ${whereClause} LIMIT ? OFFSET ?`;
			rows = sqlite.prepare(sql).all(...whereValues, limitValue, offset);
		}
		return rows.filter(
			(row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
		);
	}

	function findByIdSync(collection: string, id: string): Record<string, unknown> | null {
		validateCollectionSlug(collection);
		const row: unknown = sqlite
			.prepare(`SELECT * FROM "${resolveTableName(collection)}" WHERE id = ?`)
			.get(id);
		return isRecord(row) ? row : null;
	}

	function createSync(collection: string, data: Record<string, unknown>): Record<string, unknown> {
		validateCollectionSlug(collection);
		const id = randomUUID();
		const now = new Date().toISOString();

		const doc: Record<string, unknown> = { ...data, id, createdAt: now, updatedAt: now };
		const columns = Object.keys(doc);
		const placeholders = columns.map(() => '?').join(', ');
		const values = columns.map((col) => {
			const val = doc[col];
			if (val === undefined) return null;
			if (typeof val === 'boolean') return val ? 1 : 0;
			if (typeof val === 'object' && val !== null) return JSON.stringify(val);
			return val;
		});

		const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
		sqlite
			.prepare(
				`INSERT INTO "${resolveTableName(collection)}" (${quotedColumns}) VALUES (${placeholders})`,
			)
			.run(...values);

		return doc;
	}

	function updateSync(
		collection: string,
		id: string,
		data: Record<string, unknown>,
	): Record<string, unknown> {
		validateCollectionSlug(collection);
		const now = new Date().toISOString();
		const updateData: Record<string, unknown> = { ...data, updatedAt: now };
		delete updateData['id'];
		delete updateData['createdAt'];

		const setClauses: string[] = [];
		const values: unknown[] = [];

		for (const [key, value] of Object.entries(updateData)) {
			setClauses.push(`"${key}" = ?`);
			if (value === undefined) values.push(null);
			else if (typeof value === 'boolean') values.push(value ? 1 : 0);
			else if (typeof value === 'object' && value !== null) values.push(JSON.stringify(value));
			else values.push(value);
		}
		values.push(id);

		sqlite
			.prepare(`UPDATE "${resolveTableName(collection)}" SET ${setClauses.join(', ')} WHERE id = ?`)
			.run(...values);

		const updated: unknown = sqlite
			.prepare(`SELECT * FROM "${resolveTableName(collection)}" WHERE id = ?`)
			.get(id);
		if (!isRecord(updated)) {
			throw new Error('Failed to fetch updated document');
		}
		return updated;
	}

	function deleteSync(collection: string, id: string): boolean {
		validateCollectionSlug(collection);
		const result = sqlite
			.prepare(`DELETE FROM "${resolveTableName(collection)}" WHERE id = ?`)
			.run(id);
		return result.changes > 0;
	}

	function softDeleteSync(collection: string, id: string, field = 'deletedAt'): boolean {
		validateCollectionSlug(collection);
		validateColumnName(field);
		const now = new Date().toISOString();
		const result = sqlite
			.prepare(
				`UPDATE "${resolveTableName(collection)}" SET "${field}" = ?, "updatedAt" = ? WHERE "id" = ?`,
			)
			.run(now, now, id);
		return result.changes > 0;
	}

	function restoreSync(
		collection: string,
		id: string,
		field = 'deletedAt',
	): Record<string, unknown> {
		validateCollectionSlug(collection);
		validateColumnName(field);
		const now = new Date().toISOString();
		sqlite
			.prepare(
				`UPDATE "${resolveTableName(collection)}" SET "${field}" = NULL, "updatedAt" = ? WHERE "id" = ?`,
			)
			.run(now, id);
		const row: unknown = sqlite
			.prepare(`SELECT * FROM "${resolveTableName(collection)}" WHERE "id" = ?`)
			.get(id);
		if (!isRecord(row)) {
			throw new Error('Failed to fetch restored document');
		}
		return row;
	}

	function createVersionSync(
		collection: string,
		parentId: string,
		data: Record<string, unknown>,
		options?: CreateVersionOptions,
	): DocumentVersion {
		validateCollectionSlug(collection);
		const id = randomUUID();
		const now = new Date().toISOString();
		const tableName = `${resolveTableName(collection)}_versions`;
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
	}

	function findVersionsSync(
		collection: string,
		parentId: string,
		options?: VersionQueryOptions,
	): DocumentVersion[] {
		validateCollectionSlug(collection);
		const tableName = `${resolveTableName(collection)}_versions`;
		const limit = options?.limit ?? 10;
		const page = options?.page ?? 1;
		const offset = (page - 1) * limit;
		const sortOrder = options?.sort === 'asc' ? 'ASC' : 'DESC';

		const whereClauses: string[] = ['"parent" = ?'];
		const whereValues: unknown[] = [parentId];

		if (!options?.includeAutosave) whereClauses.push('"autosave" = 0');
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
	}

	function findVersionByIdSync(collection: string, versionId: string): DocumentVersion | null {
		validateCollectionSlug(collection);
		const tableName = `${resolveTableName(collection)}_versions`;
		const row: unknown = sqlite
			.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ?`)
			.get(versionId);

		if (!isRecord(row)) return null;

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
	}

	function restoreVersionSync(collection: string, versionId: string): Record<string, unknown> {
		validateCollectionSlug(collection);
		const tableName = `${resolveTableName(collection)}_versions`;

		const versionRow: unknown = sqlite
			.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ?`)
			.get(versionId);
		if (!isRecord(versionRow)) {
			throw new Error(
				`Version "${versionId}" not found in collection "${resolveTableName(collection)}"`,
			);
		}

		const parentId = String(versionRow['parent']);
		const versionData = parseJsonToRecord(String(versionRow['version']));
		const originalStatus = getStatusFromRow(versionRow);
		const now = new Date().toISOString();

		const setClauses: string[] = [];
		const values: unknown[] = [];
		const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

		for (const [key, value] of Object.entries(versionData)) {
			if (key === 'id' || key === 'createdAt') continue;
			if (!validColumnName.test(key)) {
				throw new Error(`Invalid column name in version data: ${key}`);
			}
			setClauses.push(`"${key}" = ?`);
			if (value === undefined) values.push(null);
			else if (typeof value === 'boolean') values.push(value ? 1 : 0);
			else if (typeof value === 'object' && value !== null) values.push(JSON.stringify(value));
			else values.push(value);
		}

		setClauses.push('"updatedAt" = ?');
		values.push(now);
		values.push(parentId);

		sqlite
			.prepare(
				`UPDATE "${resolveTableName(collection)}" SET ${setClauses.join(', ')} WHERE "id" = ?`,
			)
			.run(...values);

		const newVersionId = randomUUID();
		sqlite
			.prepare(
				`INSERT INTO "${tableName}" ("id", "parent", "version", "_status", "autosave", "createdAt", "updatedAt")
				 VALUES (?, ?, ?, ?, 0, ?, ?)`,
			)
			.run(newVersionId, parentId, String(versionRow['version']), originalStatus, now, now);

		const updated: unknown = sqlite
			.prepare(`SELECT * FROM "${resolveTableName(collection)}" WHERE "id" = ?`)
			.get(parentId);
		if (!isRecord(updated)) {
			throw new Error('Failed to fetch restored document');
		}
		return updated;
	}

	function deleteVersionsSync(collection: string, parentId: string, keepLatest?: number): number {
		validateCollectionSlug(collection);
		const tableName = `${resolveTableName(collection)}_versions`;

		if (keepLatest === undefined || keepLatest <= 0) {
			const result = sqlite.prepare(`DELETE FROM "${tableName}" WHERE "parent" = ?`).run(parentId);
			return result.changes;
		}

		const keepIds = sqlite
			.prepare(
				`SELECT "id" FROM "${tableName}" WHERE "parent" = ? ORDER BY "createdAt" DESC LIMIT ?`,
			)
			.all(parentId, keepLatest)
			.filter(isRecord)
			.map((row) => String(row['id']));

		if (keepIds.length === 0) return 0;

		const placeholders = keepIds.map(() => '?').join(', ');
		const result = sqlite
			.prepare(`DELETE FROM "${tableName}" WHERE "parent" = ? AND "id" NOT IN (${placeholders})`)
			.run(parentId, ...keepIds);
		return result.changes;
	}

	function countVersionsSync(
		collection: string,
		parentId: string,
		options?: VersionCountOptions,
	): number {
		validateCollectionSlug(collection);
		const tableName = `${resolveTableName(collection)}_versions`;

		const whereClauses: string[] = ['"parent" = ?'];
		const whereValues: unknown[] = [parentId];

		if (!options?.includeAutosave) whereClauses.push('"autosave" = 0');
		if (options?.status) {
			whereClauses.push('"_status" = ?');
			whereValues.push(options.status);
		}

		const whereClause = whereClauses.join(' AND ');
		const result = sqlite
			.prepare(`SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`)
			.get(...whereValues);

		if (isRecord(result) && typeof result['count'] === 'number') return result['count'];
		return 0;
	}

	function updateStatusSync(collection: string, id: string, status: DocumentStatus): void {
		validateCollectionSlug(collection);
		const now = new Date().toISOString();
		sqlite
			.prepare(
				`UPDATE "${resolveTableName(collection)}" SET "_status" = ?, "updatedAt" = ? WHERE "id" = ?`,
			)
			.run(status, now, id);
	}

	// ============================================
	// Return adapter object
	// ============================================

	return {
		getRawDatabase(): Database.Database {
			return sqlite;
		},

		async initialize(collections: CollectionConfig[]): Promise<void> {
			// Build slug → tableName mapping for CRUD methods
			for (const collection of collections) {
				const tbl = getTableName(collection);
				tableNameMap.set(collection.slug, tbl);
			}

			sqlite.exec(SEED_TRACKING_TABLE_SQL);
			for (const collection of collections) {
				const tbl = getTableName(collection);
				sqlite.exec(createTableSql(collection));
				const versionTableSql = createVersionTableSql(collection);
				if (versionTableSql) sqlite.exec(versionTableSql);

				// Ensure soft delete column and index exist for existing tables
				const sdField = getSoftDeleteField(collection);
				if (sdField) {
					try {
						sqlite.exec(`ALTER TABLE "${tbl}" ADD COLUMN "${sdField}" TEXT`);
					} catch {
						// Column already exists — ignore
					}
					sqlite.exec(
						`CREATE INDEX IF NOT EXISTS "idx_${tbl}_${sdField}" ON "${tbl}"("${sdField}")`,
					);
				}

				// Create explicit indexes from collection.indexes
				if (collection.indexes) {
					for (const idx of collection.indexes) {
						for (const col of idx.columns) {
							validateColumnName(col);
						}
						const idxName = idx.name ?? `idx_${tbl}_${idx.columns.join('_')}`;
						const uniqueStr = idx.unique ? 'UNIQUE ' : '';
						const colList = idx.columns.map((c) => `"${c}"`).join(', ');
						sqlite.exec(
							`CREATE ${uniqueStr}INDEX IF NOT EXISTS "${idxName}" ON "${tbl}"(${colList})`,
						);
					}
				}
			}
		},

		async find(collection, query) {
			return findSync(collection, query);
		},
		async findById(collection, id) {
			return findByIdSync(collection, id);
		},
		async create(collection, data) {
			return writeQueue.enqueue(() => createSync(collection, data));
		},
		async update(collection, id, data) {
			return writeQueue.enqueue(() => updateSync(collection, id, data));
		},
		async delete(collection, id) {
			return writeQueue.enqueue(() => deleteSync(collection, id));
		},
		async softDelete(collection, id, field) {
			return writeQueue.enqueue(() => softDeleteSync(collection, id, field));
		},
		async restore(collection, id, field) {
			return writeQueue.enqueue(() => restoreSync(collection, id, field));
		},

		async createVersion(collection, parentId, data, options) {
			return writeQueue.enqueue(() => createVersionSync(collection, parentId, data, options));
		},
		async findVersions(collection, parentId, options) {
			return findVersionsSync(collection, parentId, options);
		},
		async findVersionById(collection, versionId) {
			return findVersionByIdSync(collection, versionId);
		},
		async restoreVersion(collection, versionId) {
			return writeQueue.enqueue(() => restoreVersionSync(collection, versionId));
		},
		async deleteVersions(collection, parentId, keepLatest) {
			return writeQueue.enqueue(() => deleteVersionsSync(collection, parentId, keepLatest));
		},
		async countVersions(collection, parentId, options) {
			return countVersionsSync(collection, parentId, options);
		},
		async updateStatus(collection, id, status) {
			return writeQueue.enqueue(() => updateStatusSync(collection, id, status));
		},

		// ============================================
		// Globals Support
		// ============================================

		async initializeGlobals(_globals: GlobalConfig[]): Promise<void> {
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS "_globals" (
					"slug" TEXT PRIMARY KEY,
					"data" TEXT NOT NULL DEFAULT '{}',
					"createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
					"updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
				)
			`);
		},

		async findGlobal(slug: string): Promise<Record<string, unknown> | null> {
			const row = sqlite.prepare('SELECT * FROM "_globals" WHERE "slug" = ?').get(slug);
			if (!row || !isRecord(row)) return null;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
			const data = JSON.parse(String(row['data'])) as Record<string, unknown>;
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
			return writeQueue.enqueue(() => {
				const now = new Date().toISOString();
				const jsonData = JSON.stringify(data);
				sqlite
					.prepare(
						`
					INSERT INTO "_globals" ("slug", "data", "createdAt", "updatedAt")
					VALUES (?, ?, ?, ?)
					ON CONFLICT ("slug") DO UPDATE SET "data" = excluded."data", "updatedAt" = excluded."updatedAt"
				`,
					)
					.run(slug, jsonData, now, now);

				const row = sqlite.prepare('SELECT * FROM "_globals" WHERE "slug" = ?').get(slug);
				if (!row || !isRecord(row)) {
					return { slug, ...data, createdAt: now, updatedAt: now };
				}
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
				const returned = JSON.parse(String(row['data'])) as Record<string, unknown>;
				return {
					...returned,
					slug: row['slug'],
					createdAt: row['createdAt'],
					updatedAt: row['updatedAt'],
				};
			});
		},

		async transaction<T>(callback: (txAdapter: DatabaseAdapter) => Promise<T>): Promise<T> {
			return writeQueue.enqueue(async () => {
				sqlite.exec('BEGIN IMMEDIATE');
				try {
					const txAdapter: DatabaseAdapter = {
						async find(c, q) {
							return findSync(c, q);
						},
						async findById(c, id) {
							return findByIdSync(c, id);
						},
						async create(c, d) {
							return createSync(c, d);
						},
						async update(c, id, d) {
							return updateSync(c, id, d);
						},
						async delete(c, id) {
							return deleteSync(c, id);
						},
						async softDelete(c, id, f) {
							return softDeleteSync(c, id, f);
						},
						async restore(c, id, f) {
							return restoreSync(c, id, f);
						},
						async createVersion(c, pid, d, o) {
							return createVersionSync(c, pid, d, o);
						},
						async findVersions(c, pid, o) {
							return findVersionsSync(c, pid, o);
						},
						async findVersionById(c, vid) {
							return findVersionByIdSync(c, vid);
						},
						async restoreVersion(c, vid) {
							return restoreVersionSync(c, vid);
						},
						async deleteVersions(c, pid, k) {
							return deleteVersionsSync(c, pid, k);
						},
						async countVersions(c, pid, o) {
							return countVersionsSync(c, pid, o);
						},
						async updateStatus(c, id, s) {
							updateStatusSync(c, id, s);
						},
					};
					const result = await callback(txAdapter);
					sqlite.exec('COMMIT');
					return result;
				} catch (error) {
					sqlite.exec('ROLLBACK');
					throw error;
				}
			});
		},
	};
}

/**
 * Migration System Core Types
 *
 * Defines the migration file interface, context, and tracking types.
 */
import type { DatabaseDialect } from './schema/column-type-map';

/**
 * Helpers for data transformations within migrations.
 */
export interface DataMigrationHelpers {
	/**
	 * Backfill a column with a static value.
	 * Uses batched updates to avoid long-running transactions.
	 */
	backfill(
		table: string,
		column: string,
		value: unknown,
		options?: { where?: string; batchSize?: number },
	): Promise<number>;

	/**
	 * Transform values in a column using a SQL expression.
	 * @example transform('posts', 'slug', "LOWER(REPLACE(title, ' ', '-'))")
	 */
	transform(
		table: string,
		column: string,
		sqlExpression: string,
		options?: { where?: string; batchSize?: number },
	): Promise<number>;

	/**
	 * Safe column rename: add new column, copy data, drop old column.
	 * Safer than ALTER TABLE RENAME COLUMN for production.
	 */
	renameColumn(table: string, from: string, to: string, columnType: string): Promise<void>;

	/**
	 * Split a column into multiple columns via SQL expressions.
	 */
	splitColumn(
		table: string,
		sourceColumn: string,
		targets: Array<{
			name: string;
			type: string;
			expression: string;
		}>,
	): Promise<void>;

	/**
	 * Merge multiple columns into one.
	 */
	mergeColumns(
		table: string,
		sourceColumns: string[],
		targetColumn: string,
		targetType: string,
		mergeExpression: string,
	): Promise<void>;

	/**
	 * Copy data between tables with optional transformation.
	 */
	copyData(
		sourceTable: string,
		targetTable: string,
		columnMapping: Record<string, string | { expression: string }>,
		options?: { where?: string; batchSize?: number },
	): Promise<number>;

	/**
	 * Move a flat column's data into a JSONB field.
	 */
	columnToJson(
		table: string,
		sourceColumn: string,
		jsonColumn: string,
		jsonKey: string,
	): Promise<void>;

	/**
	 * Extract a key from a JSONB column into a new flat column.
	 */
	jsonToColumn(
		table: string,
		jsonColumn: string,
		jsonKey: string,
		targetColumn: string,
		targetType: string,
	): Promise<void>;

	/**
	 * Deduplicate rows before adding a unique constraint.
	 * Keeps the row based on the chosen strategy.
	 * @returns Number of rows deleted
	 */
	dedup(
		table: string,
		columns: string[],
		keepStrategy?: 'latest' | 'earliest' | 'first',
	): Promise<number>;
}

/**
 * Context passed to migration up/down functions.
 */
export interface MigrationContext {
	/** Execute raw SQL (DDL or DML) */
	sql(query: string, params?: unknown[]): Promise<void>;

	/** Query raw SQL and return rows */
	query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

	/** Data migration helpers */
	data: DataMigrationHelpers;

	/** Current database dialect */
	dialect: DatabaseDialect;

	/** Logger */
	log: {
		info(message: string): void;
		warn(message: string): void;
	};
}

/**
 * Metadata for a migration file.
 */
export interface MigrationMeta {
	/** Migration name (filename without extension) */
	name: string;
	/** Human-readable description */
	description: string;
	/** Operations this migration will apply (for danger detection) */
	operations?: ReadonlyArray<{ type: string; [key: string]: unknown }>;
}

/**
 * A migration file's exports.
 */
export interface MigrationFile {
	/** Migration metadata */
	meta: MigrationMeta;
	/** Apply the migration */
	up(ctx: MigrationContext): Promise<void>;
	/** Revert the migration */
	down(ctx: MigrationContext): Promise<void>;
}

/**
 * Internal tracking record for an applied migration.
 * Stored in the _momentum_migrations table.
 */
export interface MigrationTrackingRecord {
	/** Auto-generated UUID primary key */
	id: string;
	/** Migration name (matches filename without extension) */
	name: string;
	/** Batch number (migrations applied together share a batch) */
	batch: number;
	/** SHA-256 checksum of the migration file content */
	checksum: string;
	/** When the migration was applied (ISO string) */
	appliedAt: string;
	/** Execution time in milliseconds */
	executionMs: number;
}

/**
 * Slug for the internal migration tracking table.
 */
export const MIGRATION_TRACKING_TABLE = '_momentum_migrations';

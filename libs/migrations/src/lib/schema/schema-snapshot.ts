/**
 * Schema Snapshot Types
 *
 * Represents the structure of a database at a point in time.
 * Used for diffing, drift detection, and migration generation.
 */
import { createHash } from 'node:crypto';

/**
 * Snapshot of a single database column.
 */
export interface ColumnSnapshot {
	/** Column name */
	name: string;
	/** Raw database type (e.g., VARCHAR(36), TEXT, JSONB) */
	type: string;
	/** Whether the column accepts NULL */
	nullable: boolean;
	/** Default value expression, or null */
	defaultValue: string | null;
	/** Whether this column is the primary key */
	isPrimaryKey: boolean;
}

/**
 * Snapshot of a foreign key constraint.
 */
export interface ForeignKeySnapshot {
	/** Constraint name */
	constraintName: string;
	/** Column in the source table */
	column: string;
	/** Referenced table */
	referencedTable: string;
	/** Referenced column */
	referencedColumn: string;
	/** ON DELETE action (CASCADE, SET NULL, RESTRICT, NO ACTION) */
	onDelete: string;
}

/**
 * Snapshot of a database index.
 */
export interface IndexSnapshot {
	/** Index name */
	name: string;
	/** Columns included in the index */
	columns: string[];
	/** Whether the index enforces uniqueness */
	unique: boolean;
}

/**
 * Snapshot of a single database table.
 */
export interface TableSnapshot {
	/** Table name */
	name: string;
	/** All columns in the table */
	columns: ColumnSnapshot[];
	/** Foreign key constraints */
	foreignKeys: ForeignKeySnapshot[];
	/** Indexes (excluding the primary key index) */
	indexes: IndexSnapshot[];
}

/**
 * Complete snapshot of a database schema.
 */
export interface DatabaseSchemaSnapshot {
	/** Database dialect */
	dialect: 'postgresql' | 'sqlite';
	/** All tables in the schema */
	tables: TableSnapshot[];
	/** When this snapshot was captured (ISO string) */
	capturedAt: string;
	/** SHA-256 checksum of the canonical JSON (for drift detection) */
	checksum: string;
}

/**
 * Internal tables that should be excluded from schema snapshots.
 */
export const INTERNAL_TABLES = new Set(['_momentum_migrations', '_momentum_seeds', '_globals']);

/**
 * Compute a deterministic SHA-256 checksum for a schema snapshot.
 * The checksum is computed over the sorted, canonical JSON of tables only
 * (excluding capturedAt and checksum fields).
 */
export function computeSchemaChecksum(tables: TableSnapshot[]): string {
	// Sort tables by name, and within each table sort columns/FKs/indexes by name
	const normalized = tables
		.map((t) => ({
			name: t.name,
			columns: [...t.columns].sort((a, b) => a.name.localeCompare(b.name)),
			foreignKeys: [...t.foreignKeys].sort((a, b) =>
				a.constraintName.localeCompare(b.constraintName),
			),
			indexes: [...t.indexes].sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const json = JSON.stringify(normalized);
	return createHash('sha256').update(json).digest('hex');
}

/**
 * Create a DatabaseSchemaSnapshot from a list of tables.
 */
export function createSchemaSnapshot(
	dialect: 'postgresql' | 'sqlite',
	tables: TableSnapshot[],
): DatabaseSchemaSnapshot {
	return {
		dialect,
		tables,
		capturedAt: new Date().toISOString(),
		checksum: computeSchemaChecksum(tables),
	};
}

/**
 * Serialize a snapshot to JSON string (for .snapshot.json files).
 */
export function serializeSnapshot(snapshot: DatabaseSchemaSnapshot): string {
	return JSON.stringify(snapshot, null, '\t');
}

/**
 * Deserialize a snapshot from a JSON string.
 */
export function deserializeSnapshot(json: string): DatabaseSchemaSnapshot {
	const parsed: unknown = JSON.parse(json);
	if (!isSchemaSnapshot(parsed)) {
		throw new Error('Invalid schema snapshot JSON');
	}
	return parsed;
}

/**
 * Type guard for DatabaseSchemaSnapshot.
 */
function isSchemaSnapshot(value: unknown): value is DatabaseSchemaSnapshot {
	if (typeof value !== 'object' || value === null) return false;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing object to Record for property access in type guard
	const obj = value as Record<string, unknown>;
	return (
		(obj['dialect'] === 'postgresql' || obj['dialect'] === 'sqlite') &&
		Array.isArray(obj['tables']) &&
		typeof obj['capturedAt'] === 'string' &&
		typeof obj['checksum'] === 'string'
	);
}

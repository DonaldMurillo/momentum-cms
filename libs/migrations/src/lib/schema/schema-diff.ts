/**
 * Schema Diff Engine
 *
 * Compares two DatabaseSchemaSnapshots (desired vs actual) and produces
 * an ordered list of MigrationOperations to reconcile the differences.
 *
 * Features:
 * - Table create/drop detection
 * - Column add/drop/alter detection
 * - Type change detection with normalization
 * - Nullable and default value change detection
 * - Foreign key add/drop detection
 * - Index create/drop detection
 * - Heuristic rename detection (column disappears + new one with compatible type)
 */
import type {
	TableSnapshot,
	ColumnSnapshot,
	ForeignKeySnapshot,
	IndexSnapshot,
	DatabaseSchemaSnapshot,
} from './schema-snapshot';
import type { MigrationOperation } from '../operations/operation.types';
import type { DatabaseDialect } from './column-type-map';
import { areTypesCompatible, normalizeColumnType } from './column-type-map';

/**
 * Options for the diff engine.
 */
export interface SchemaDiffOptions {
	/**
	 * Enable heuristic rename detection.
	 * When a column disappears and a new one appears with the same type,
	 * suggest a rename instead of drop+add.
	 * @default true
	 */
	detectRenames?: boolean;

	/**
	 * Similarity threshold for rename detection (0-1).
	 * Currently unused but reserved for fuzzy name matching.
	 * @default 0.6
	 */
	renameSimilarityThreshold?: number;
}

const DEFAULT_DIFF_OPTIONS: Required<SchemaDiffOptions> = {
	detectRenames: true,
	renameSimilarityThreshold: 0.6,
};

/**
 * Result of a schema diff operation.
 */
export interface SchemaDiffResult {
	/** Whether the schemas are identical */
	hasChanges: boolean;

	/** Ordered list of operations to apply */
	operations: MigrationOperation[];

	/** Summary of changes for human-readable output */
	summary: string[];
}

/**
 * Diff two schema snapshots and produce migration operations.
 *
 * @param desired - The schema we want (from collection configs)
 * @param actual - The schema we have (from database introspection)
 * @param dialect - The database dialect for type normalization
 * @param options - Diff options
 */
export function diffSchemas(
	desired: DatabaseSchemaSnapshot,
	actual: DatabaseSchemaSnapshot,
	dialect: DatabaseDialect,
	options?: SchemaDiffOptions,
): SchemaDiffResult {
	const opts = { ...DEFAULT_DIFF_OPTIONS, ...options };
	const operations: MigrationOperation[] = [];
	const summary: string[] = [];

	const desiredMap = new Map<string, TableSnapshot>();
	const actualMap = new Map<string, TableSnapshot>();

	for (const t of desired.tables) desiredMap.set(t.name, t);
	for (const t of actual.tables) actualMap.set(t.name, t);

	// 1. Tables to create (in desired but not in actual)
	for (const [name, desiredTable] of desiredMap) {
		if (!actualMap.has(name)) {
			operations.push({
				type: 'createTable',
				table: name,
				columns: desiredTable.columns.map((c) => ({
					name: c.name,
					type: c.type,
					nullable: c.nullable,
					defaultValue: c.defaultValue ?? undefined,
					primaryKey: c.isPrimaryKey || undefined,
				})),
			});
			summary.push(`Create table "${name}"`);

			// Add FKs and indexes for new tables
			for (const fk of desiredTable.foreignKeys) {
				operations.push({
					type: 'addForeignKey',
					table: name,
					constraintName: fk.constraintName,
					column: fk.column,
					referencedTable: fk.referencedTable,
					referencedColumn: fk.referencedColumn,
					onDelete: fk.onDelete,
				});
			}
			for (const idx of desiredTable.indexes) {
				operations.push({
					type: 'createIndex',
					table: name,
					indexName: idx.name,
					columns: idx.columns,
					unique: idx.unique,
				});
			}
		}
	}

	// 2. Tables to drop (in actual but not in desired)
	for (const [name] of actualMap) {
		if (!desiredMap.has(name)) {
			operations.push({ type: 'dropTable', table: name });
			summary.push(`Drop table "${name}"`);
		}
	}

	// 3. Tables that exist in both — diff columns, FKs, indexes
	for (const [name, desiredTable] of desiredMap) {
		const actualTable = actualMap.get(name);
		if (!actualTable) continue;

		const tableOps = diffTable(desiredTable, actualTable, dialect, opts);
		operations.push(...tableOps.operations);
		summary.push(...tableOps.summary);
	}

	return {
		hasChanges: operations.length > 0,
		operations,
		summary,
	};
}

/**
 * Internal: diff a single table.
 */
function diffTable(
	desired: TableSnapshot,
	actual: TableSnapshot,
	dialect: DatabaseDialect,
	opts: Required<SchemaDiffOptions>,
): { operations: MigrationOperation[]; summary: string[] } {
	const operations: MigrationOperation[] = [];
	const summary: string[] = [];
	const tableName = desired.name;

	// --- Column diffs ---
	const colOps = diffColumns(tableName, desired.columns, actual.columns, dialect, opts);
	operations.push(...colOps.operations);
	summary.push(...colOps.summary);

	// --- Foreign key diffs ---
	const fkOps = diffForeignKeys(tableName, desired.foreignKeys, actual.foreignKeys);
	operations.push(...fkOps.operations);
	summary.push(...fkOps.summary);

	// --- Index diffs ---
	const idxOps = diffIndexes(tableName, desired.indexes, actual.indexes);
	operations.push(...idxOps.operations);
	summary.push(...idxOps.summary);

	return { operations, summary };
}

/**
 * Internal: diff columns between desired and actual table.
 */
function diffColumns(
	tableName: string,
	desiredColumns: ColumnSnapshot[],
	actualColumns: ColumnSnapshot[],
	dialect: DatabaseDialect,
	opts: Required<SchemaDiffOptions>,
): { operations: MigrationOperation[]; summary: string[] } {
	const operations: MigrationOperation[] = [];
	const summary: string[] = [];

	const desiredMap = new Map<string, ColumnSnapshot>();
	const actualMap = new Map<string, ColumnSnapshot>();

	for (const c of desiredColumns) desiredMap.set(c.name, c);
	for (const c of actualColumns) actualMap.set(c.name, c);

	// Track columns consumed by rename detection
	const renamedFrom = new Set<string>();
	const renamedTo = new Set<string>();

	// Rename detection: find columns that disappeared + new ones with compatible types
	if (opts.detectRenames) {
		const missingInActual = [...desiredMap.keys()].filter((k) => !actualMap.has(k));
		const extraInActual = [...actualMap.keys()].filter((k) => !desiredMap.has(k));

		for (const newName of missingInActual) {
			const desiredCol = desiredMap.get(newName);
			if (!desiredCol) continue;

			// Find a matching old column with compatible type
			for (const oldName of extraInActual) {
				if (renamedFrom.has(oldName)) continue;
				const actualCol = actualMap.get(oldName);
				if (!actualCol) continue;

				if (areTypesCompatible(desiredCol.type, actualCol.type, dialect)) {
					operations.push({
						type: 'renameColumn',
						table: tableName,
						from: oldName,
						to: newName,
					});
					summary.push(
						`Rename column "${tableName}"."${oldName}" → "${newName}"`,
					);
					renamedFrom.add(oldName);
					renamedTo.add(newName);
					break;
				}
			}
		}
	}

	// Add columns (in desired but not in actual, and not handled by rename)
	for (const [name, desiredCol] of desiredMap) {
		if (actualMap.has(name) || renamedTo.has(name)) continue;

		operations.push({
			type: 'addColumn',
			table: tableName,
			column: name,
			columnType: desiredCol.type,
			nullable: desiredCol.nullable,
			defaultValue: desiredCol.defaultValue ?? undefined,
		});
		summary.push(`Add column "${tableName}"."${name}" (${desiredCol.type})`);
	}

	// Drop columns (in actual but not in desired, and not handled by rename)
	for (const [name, actualCol] of actualMap) {
		if (desiredMap.has(name) || renamedFrom.has(name)) continue;

		operations.push({
			type: 'dropColumn',
			table: tableName,
			column: name,
			previousType: actualCol.type,
			previousNullable: actualCol.nullable,
		});
		summary.push(`Drop column "${tableName}"."${name}"`);
	}

	// Alter columns (exist in both — check type, nullable, default)
	for (const [name, desiredCol] of desiredMap) {
		const actualCol = actualMap.get(name);
		if (!actualCol) continue;

		// Type change
		if (!areTypesCompatible(desiredCol.type, actualCol.type, dialect)) {
			operations.push({
				type: 'alterColumnType',
				table: tableName,
				column: name,
				fromType: normalizeColumnType(actualCol.type, dialect),
				toType: normalizeColumnType(desiredCol.type, dialect),
			});
			summary.push(
				`Change type "${tableName}"."${name}": ${actualCol.type} → ${desiredCol.type}`,
			);
		}

		// Nullable change
		if (desiredCol.nullable !== actualCol.nullable) {
			operations.push({
				type: 'alterColumnNullable',
				table: tableName,
				column: name,
				nullable: desiredCol.nullable,
			});
			summary.push(
				`Change nullable "${tableName}"."${name}": ${actualCol.nullable} → ${desiredCol.nullable}`,
			);
		}

		// Default value change
		if (normalizeDefault(desiredCol.defaultValue) !== normalizeDefault(actualCol.defaultValue)) {
			operations.push({
				type: 'alterColumnDefault',
				table: tableName,
				column: name,
				defaultValue: desiredCol.defaultValue,
				previousDefault: actualCol.defaultValue,
			});
			summary.push(
				`Change default "${tableName}"."${name}": ${actualCol.defaultValue ?? 'NULL'} → ${desiredCol.defaultValue ?? 'NULL'}`,
			);
		}
	}

	return { operations, summary };
}

/**
 * Normalize a default value for comparison.
 * Treats null, undefined, and empty string as equivalent.
 */
function normalizeDefault(value: string | null | undefined): string | null {
	if (value === null || value === undefined || value === '') return null;
	return value;
}

/**
 * Internal: diff foreign keys.
 */
function diffForeignKeys(
	tableName: string,
	desiredFks: ForeignKeySnapshot[],
	actualFks: ForeignKeySnapshot[],
): { operations: MigrationOperation[]; summary: string[] } {
	const operations: MigrationOperation[] = [];
	const summary: string[] = [];

	const desiredMap = new Map<string, ForeignKeySnapshot>();
	const actualMap = new Map<string, ForeignKeySnapshot>();

	for (const fk of desiredFks) desiredMap.set(fk.constraintName, fk);
	for (const fk of actualFks) actualMap.set(fk.constraintName, fk);

	// Add new FKs
	for (const [name, fk] of desiredMap) {
		if (!actualMap.has(name)) {
			operations.push({
				type: 'addForeignKey',
				table: tableName,
				constraintName: fk.constraintName,
				column: fk.column,
				referencedTable: fk.referencedTable,
				referencedColumn: fk.referencedColumn,
				onDelete: fk.onDelete,
			});
			summary.push(`Add foreign key "${name}" on "${tableName}"`);
		} else {
			// FK exists — check if definition changed (drop + re-add)
			const actualFk = actualMap.get(name);
			if (!actualFk) continue;
			if (
				fk.column !== actualFk.column ||
				fk.referencedTable !== actualFk.referencedTable ||
				fk.referencedColumn !== actualFk.referencedColumn ||
				fk.onDelete !== actualFk.onDelete
			) {
				operations.push({
					type: 'dropForeignKey',
					table: tableName,
					constraintName: name,
				});
				operations.push({
					type: 'addForeignKey',
					table: tableName,
					constraintName: fk.constraintName,
					column: fk.column,
					referencedTable: fk.referencedTable,
					referencedColumn: fk.referencedColumn,
					onDelete: fk.onDelete,
				});
				summary.push(`Modify foreign key "${name}" on "${tableName}"`);
			}
		}
	}

	// Drop old FKs
	for (const [name] of actualMap) {
		if (!desiredMap.has(name)) {
			operations.push({
				type: 'dropForeignKey',
				table: tableName,
				constraintName: name,
			});
			summary.push(`Drop foreign key "${name}" on "${tableName}"`);
		}
	}

	return { operations, summary };
}

/**
 * Internal: diff indexes.
 */
function diffIndexes(
	tableName: string,
	desiredIdxs: IndexSnapshot[],
	actualIdxs: IndexSnapshot[],
): { operations: MigrationOperation[]; summary: string[] } {
	const operations: MigrationOperation[] = [];
	const summary: string[] = [];

	const desiredMap = new Map<string, IndexSnapshot>();
	const actualMap = new Map<string, IndexSnapshot>();

	for (const idx of desiredIdxs) desiredMap.set(idx.name, idx);
	for (const idx of actualIdxs) actualMap.set(idx.name, idx);

	// Create new indexes
	for (const [name, idx] of desiredMap) {
		if (!actualMap.has(name)) {
			operations.push({
				type: 'createIndex',
				table: tableName,
				indexName: idx.name,
				columns: idx.columns,
				unique: idx.unique,
			});
			summary.push(`Create index "${name}" on "${tableName}"`);
		} else {
			// Index exists — check if definition changed (drop + re-create)
			const actualIdx = actualMap.get(name);
			if (!actualIdx) continue;
			if (
				idx.unique !== actualIdx.unique ||
				JSON.stringify(idx.columns) !== JSON.stringify(actualIdx.columns)
			) {
				operations.push({
					type: 'dropIndex',
					table: tableName,
					indexName: name,
				});
				operations.push({
					type: 'createIndex',
					table: tableName,
					indexName: idx.name,
					columns: idx.columns,
					unique: idx.unique,
				});
				summary.push(`Modify index "${name}" on "${tableName}"`);
			}
		}
	}

	// Drop old indexes
	for (const [name] of actualMap) {
		if (!desiredMap.has(name)) {
			operations.push({
				type: 'dropIndex',
				table: tableName,
				indexName: name,
			});
			summary.push(`Drop index "${name}" on "${tableName}"`);
		}
	}

	return { operations, summary };
}

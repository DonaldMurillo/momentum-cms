/**
 * SQLite Schema Introspection
 *
 * Reads the current database schema from SQLite system tables.
 * Returns a DatabaseSchemaSnapshot for diffing against collection config.
 */
import {
	type TableSnapshot,
	type ColumnSnapshot,
	type ForeignKeySnapshot,
	type IndexSnapshot,
	type DatabaseSchemaSnapshot,
	INTERNAL_TABLES,
	createSchemaSnapshot,
} from './schema-snapshot';
import { normalizeColumnType } from './column-type-map';

/**
 * Row from sqlite_master for tables.
 */
interface SqliteMasterRow {
	[key: string]: unknown;
	name: string;
	type: string;
	sql: string;
}

/**
 * Row from PRAGMA table_info.
 */
interface SqliteColumnRow {
	[key: string]: unknown;
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

/**
 * Row from PRAGMA foreign_key_list.
 */
interface SqliteFkRow {
	[key: string]: unknown;
	id: number;
	seq: number;
	table: string;
	from: string;
	to: string;
	on_delete: string;
}

/**
 * Row from PRAGMA index_list.
 */
interface SqliteIndexListRow {
	[key: string]: unknown;
	seq: number;
	name: string;
	unique: number;
	origin: string;
}

/**
 * Row from PRAGMA index_info.
 */
interface SqliteIndexInfoRow {
	[key: string]: unknown;
	seqno: number;
	cid: number;
	name: string;
}

/**
 * Query function for SQLite — all return values must use consistent interface.
 * SQLite drivers return results synchronously but we use async for adapter compat.
 */
export type SqliteQueryFunction = <T extends Record<string, unknown>>(
	sql: string,
	params?: unknown[],
) => Promise<T[]>;

/**
 * Introspect the SQLite database schema.
 *
 * @param queryFn - Function to execute SQL queries
 */
export async function introspectSqlite(
	queryFn: SqliteQueryFunction,
): Promise<DatabaseSchemaSnapshot> {
	// Get all user tables
	const masterRows = await queryFn<SqliteMasterRow>(
		`SELECT name, type, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
	);

	const tables: TableSnapshot[] = [];

	for (const masterRow of masterRows) {
		const tableName = masterRow.name;
		if (INTERNAL_TABLES.has(tableName)) continue;

		// Get column info
		const columnRows = await queryFn<SqliteColumnRow>(
			`PRAGMA table_info("${tableName}")`,
		);

		const columns: ColumnSnapshot[] = columnRows.map((row) => ({
			name: row.name,
			type: normalizeColumnType(row.type || 'TEXT', 'sqlite'),
			nullable: row.notnull === 0,
			defaultValue: row.dflt_value,
			isPrimaryKey: row.pk > 0,
		}));

		// Get foreign keys
		const fkRows = await queryFn<SqliteFkRow>(
			`PRAGMA foreign_key_list("${tableName}")`,
		);

		const foreignKeys: ForeignKeySnapshot[] = fkRows.map((row) => ({
			constraintName: `fk_${tableName}_${row.from}`,
			column: row.from,
			referencedTable: row.table,
			referencedColumn: row.to,
			onDelete: row.on_delete,
		}));

		// Get indexes
		const indexListRows = await queryFn<SqliteIndexListRow>(
			`PRAGMA index_list("${tableName}")`,
		);

		const indexes: IndexSnapshot[] = [];
		for (const idxRow of indexListRows) {
			// Skip auto-generated indexes (pk, unique constraints from CREATE TABLE)
			if (idxRow.origin === 'pk') continue;

			const indexInfoRows = await queryFn<SqliteIndexInfoRow>(
				`PRAGMA index_info("${idxRow.name}")`,
			);

			const indexColumns = indexInfoRows
				.sort((a, b) => a.seqno - b.seqno)
				.map((r) => r.name)
				.filter((n) => n.length > 0);

			if (indexColumns.length > 0) {
				indexes.push({
					name: idxRow.name,
					columns: indexColumns,
					unique: idxRow.unique === 1,
				});
			}
		}

		tables.push({
			name: tableName,
			columns,
			foreignKeys,
			indexes,
		});
	}

	return createSchemaSnapshot('sqlite', tables);
}

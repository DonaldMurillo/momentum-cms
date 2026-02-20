/**
 * PostgreSQL Schema Introspection
 *
 * Reads the current database schema from PostgreSQL system catalogs.
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
 * Raw column row from information_schema.columns.
 */
interface PgColumnRow {
	[key: string]: unknown;
	table_name: string;
	column_name: string;
	data_type: string;
	character_maximum_length: number | null;
	is_nullable: string;
	column_default: string | null;
}

/**
 * Raw foreign key row from pg_constraint join.
 */
interface PgForeignKeyRow {
	[key: string]: unknown;
	table_name: string;
	constraint_name: string;
	column_name: string;
	foreign_table_name: string;
	foreign_column_name: string;
	delete_rule: string;
}

/**
 * Raw index row from pg_indexes.
 */
interface PgIndexRow {
	[key: string]: unknown;
	tablename: string;
	indexname: string;
	indexdef: string;
}

/**
 * Raw primary key row.
 */
interface PgPrimaryKeyRow {
	[key: string]: unknown;
	table_name: string;
	column_name: string;
}

/**
 * Query function signature — abstracts away the specific database driver.
 */
export type QueryFunction = <T extends Record<string, unknown>>(
	sql: string,
	params?: unknown[],
) => Promise<T[]>;

/**
 * Introspect the PostgreSQL database schema.
 * Queries information_schema and pg_catalog to build a complete snapshot.
 *
 * @param queryFn - Function to execute SQL queries (from adapter.queryRaw)
 * @param schema - PostgreSQL schema name to introspect (default: 'public')
 */
export async function introspectPostgres(
	queryFn: QueryFunction,
	schema = 'public',
): Promise<DatabaseSchemaSnapshot> {
	// Run all introspection queries in parallel
	const [columnRows, fkRows, indexRows, pkRows] = await Promise.all([
		queryFn<PgColumnRow>(
			`SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default
			 FROM information_schema.columns
			 WHERE table_schema = $1
			 ORDER BY table_name, ordinal_position`,
			[schema],
		),
		queryFn<PgForeignKeyRow>(
			`SELECT
				tc.table_name,
				tc.constraint_name,
				kcu.column_name,
				ccu.table_name AS foreign_table_name,
				ccu.column_name AS foreign_column_name,
				rc.delete_rule
			 FROM information_schema.table_constraints tc
			 JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			 JOIN information_schema.constraint_column_usage ccu
				ON ccu.constraint_name = tc.constraint_name
				AND ccu.table_schema = tc.table_schema
			 JOIN information_schema.referential_constraints rc
				ON rc.constraint_name = tc.constraint_name
				AND rc.constraint_schema = tc.constraint_schema
			 WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = $1
			 ORDER BY tc.table_name, tc.constraint_name`,
			[schema],
		),
		queryFn<PgIndexRow>(
			`SELECT tablename, indexname, indexdef
			 FROM pg_indexes
			 WHERE schemaname = $1
			 ORDER BY tablename, indexname`,
			[schema],
		),
		queryFn<PgPrimaryKeyRow>(
			`SELECT tc.table_name, kcu.column_name
			 FROM information_schema.table_constraints tc
			 JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			 WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = $1`,
			[schema],
		),
	]);

	// Build primary key lookup: table -> Set<column>
	const pkLookup = new Map<string, Set<string>>();
	for (const row of pkRows) {
		const tableName = row.table_name;
		if (!pkLookup.has(tableName)) {
			pkLookup.set(tableName, new Set());
		}
		pkLookup.get(tableName)!.add(row.column_name);
	}

	// Group columns by table
	const tableColumnsMap = new Map<string, ColumnSnapshot[]>();
	for (const row of columnRows) {
		const tableName = row.table_name;
		if (INTERNAL_TABLES.has(tableName)) continue;

		if (!tableColumnsMap.has(tableName)) {
			tableColumnsMap.set(tableName, []);
		}

		const rawType = buildPgColumnType(row);
		const pkSet = pkLookup.get(tableName);

		tableColumnsMap.get(tableName)!.push({
			name: row.column_name,
			type: normalizeColumnType(rawType, 'postgresql'),
			nullable: row.is_nullable === 'YES',
			defaultValue: row.column_default,
			isPrimaryKey: pkSet?.has(row.column_name) ?? false,
		});
	}

	// Group FKs by table
	const tableFkMap = new Map<string, ForeignKeySnapshot[]>();
	for (const row of fkRows) {
		const tableName = row.table_name;
		if (INTERNAL_TABLES.has(tableName)) continue;

		if (!tableFkMap.has(tableName)) {
			tableFkMap.set(tableName, []);
		}

		tableFkMap.get(tableName)!.push({
			constraintName: row.constraint_name,
			column: row.column_name,
			referencedTable: row.foreign_table_name,
			referencedColumn: row.foreign_column_name,
			onDelete: row.delete_rule,
		});
	}

	// Group indexes by table, filtering out PK indexes and FK constraint indexes
	const fkConstraintNames = new Set(fkRows.map((r) => r.constraint_name));
	// PK indexes typically have the same name as the PK constraint — we detect by checking indexdef
	const tableIndexMap = new Map<string, IndexSnapshot[]>();
	for (const row of indexRows) {
		const tableName = row.tablename;
		if (INTERNAL_TABLES.has(tableName)) continue;

		// Skip primary key indexes
		if (row.indexdef.includes('PRIMARY KEY')) continue;
		// Skip indexes that are FK constraint backing indexes
		if (fkConstraintNames.has(row.indexname)) continue;
		// Skip PK-named indexes (pattern: {table}_pkey)
		if (row.indexname.endsWith('_pkey')) continue;

		if (!tableIndexMap.has(tableName)) {
			tableIndexMap.set(tableName, []);
		}

		const columns = extractIndexColumns(row.indexdef);
		const unique = row.indexdef.toUpperCase().includes('UNIQUE');

		tableIndexMap.get(tableName)!.push({
			name: row.indexname,
			columns,
			unique,
		});
	}

	// Build table snapshots
	const tables: TableSnapshot[] = [];
	for (const [tableName, columns] of tableColumnsMap) {
		tables.push({
			name: tableName,
			columns,
			foreignKeys: tableFkMap.get(tableName) ?? [],
			indexes: tableIndexMap.get(tableName) ?? [],
		});
	}

	return createSchemaSnapshot('postgresql', tables);
}

/**
 * Build the full PostgreSQL type string from information_schema row.
 * Combines data_type with character_maximum_length when relevant.
 */
function buildPgColumnType(row: PgColumnRow): string {
	const dataType = row.data_type.toUpperCase();

	// character varying → VARCHAR(N) or VARCHAR(255)
	if (dataType === 'CHARACTER VARYING') {
		const len = row.character_maximum_length ?? 255;
		return `VARCHAR(${len})`;
	}

	// character → CHAR(N)
	if (dataType === 'CHARACTER') {
		const len = row.character_maximum_length ?? 1;
		return `CHAR(${len})`;
	}

	return dataType;
}

/**
 * Extract column names from a CREATE INDEX definition string.
 * @example "CREATE INDEX idx_foo ON bar (col1, col2)" → ["col1", "col2"]
 */
function extractIndexColumns(indexDef: string): string[] {
	// Match the parenthesized column list after ON "table"
	const match = indexDef.match(/\(([^)]+)\)\s*$/);
	if (!match) return [];

	return match[1]
		.split(',')
		.map((col) => col.trim().replace(/^"/, '').replace(/"$/, ''))
		.filter((col) => col.length > 0);
}

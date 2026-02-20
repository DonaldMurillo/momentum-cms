/**
 * SQL Generator
 *
 * Converts MigrationOperations into raw SQL strings for a given dialect.
 * Used by both the migration file generator and the push-mode runner.
 */
import type { MigrationOperation } from '../operations/operation.types';
import type { DatabaseDialect } from '../schema/column-type-map';

/**
 * Generate SQL for a single migration operation.
 */
export function operationToSql(
	op: MigrationOperation,
	dialect: DatabaseDialect,
): string {
	switch (op.type) {
		case 'createTable':
			return generateCreateTable(op, dialect);
		case 'dropTable':
			return `DROP TABLE IF EXISTS "${op.table}"`;
		case 'renameTable':
			return `ALTER TABLE "${op.from}" RENAME TO "${op.to}"`;
		case 'addColumn':
			return generateAddColumn(op, dialect);
		case 'dropColumn':
			return generateDropColumn(op, dialect);
		case 'alterColumnType':
			return generateAlterColumnType(op, dialect);
		case 'alterColumnNullable':
			return generateAlterColumnNullable(op, dialect);
		case 'alterColumnDefault':
			return generateAlterColumnDefault(op, dialect);
		case 'renameColumn':
			return `ALTER TABLE "${op.table}" RENAME COLUMN "${op.from}" TO "${op.to}"`;
		case 'addForeignKey':
			return generateAddForeignKey(op, dialect);
		case 'dropForeignKey':
			return generateDropForeignKey(op, dialect);
		case 'createIndex':
			return generateCreateIndex(op);
		case 'dropIndex':
			return `DROP INDEX IF EXISTS "${op.indexName}"`;
		case 'rawSql':
			return op.upSql;
	}
}

/**
 * Generate SQL for the reverse (down) of an operation.
 */
export function operationToReverseSql(
	op: MigrationOperation,
	dialect: DatabaseDialect,
): string | null {
	switch (op.type) {
		case 'createTable':
			return `DROP TABLE IF EXISTS "${op.table}"`;
		case 'dropTable':
			return null; // Can't reverse a drop without the full table definition
		case 'renameTable':
			return `ALTER TABLE "${op.to}" RENAME TO "${op.from}"`;
		case 'addColumn':
			return `ALTER TABLE "${op.table}" DROP COLUMN "${op.column}"`;
		case 'dropColumn':
			if (op.previousType) {
				const nullable = op.previousNullable !== false ? '' : ' NOT NULL';
				return `ALTER TABLE "${op.table}" ADD COLUMN "${op.column}" ${op.previousType}${nullable}`;
			}
			return null;
		case 'alterColumnType':
			return generateAlterColumnType(
				{ ...op, fromType: op.toType, toType: op.fromType },
				dialect,
			);
		case 'alterColumnNullable':
			return generateAlterColumnNullable(
				{ ...op, nullable: !op.nullable },
				dialect,
			);
		case 'alterColumnDefault':
			return generateAlterColumnDefault(
				{
					...op,
					defaultValue: op.previousDefault,
					previousDefault: op.defaultValue,
				},
				dialect,
			);
		case 'renameColumn':
			return `ALTER TABLE "${op.table}" RENAME COLUMN "${op.to}" TO "${op.from}"`;
		case 'addForeignKey':
			return generateDropForeignKey(
				{ type: 'dropForeignKey', table: op.table, constraintName: op.constraintName },
				dialect,
			);
		case 'dropForeignKey':
			return null; // Can't reverse without FK definition
		case 'createIndex':
			return `DROP INDEX IF EXISTS "${op.indexName}"`;
		case 'dropIndex':
			return null; // Can't reverse without index definition
		case 'rawSql':
			return op.downSql;
	}
}

/**
 * Generate all up SQL statements for a set of operations.
 */
export function operationsToUpSql(
	operations: MigrationOperation[],
	dialect: DatabaseDialect,
): string[] {
	return operations.map((op) => operationToSql(op, dialect));
}

/**
 * Generate all down SQL statements for a set of operations (in reverse order).
 */
export function operationsToDownSql(
	operations: MigrationOperation[],
	dialect: DatabaseDialect,
): string[] {
	return [...operations]
		.reverse()
		.map((op) => operationToReverseSql(op, dialect))
		.filter((sql): sql is string => sql !== null);
}

// ============================================
// Internal generators
// ============================================

function generateCreateTable(
	op: Extract<MigrationOperation, { type: 'createTable' }>,
	_dialect: DatabaseDialect,
): string {
	const columnDefs = op.columns.map((c) => {
		let def = `"${c.name}" ${c.type}`;
		if (c.primaryKey) def += ' PRIMARY KEY';
		if (!c.nullable) def += ' NOT NULL';
		if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
		return def;
	});
	return `CREATE TABLE "${op.table}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

function generateAddColumn(
	op: Extract<MigrationOperation, { type: 'addColumn' }>,
	_dialect: DatabaseDialect,
): string {
	let sql = `ALTER TABLE "${op.table}" ADD COLUMN "${op.column}" ${op.columnType}`;
	if (!op.nullable) sql += ' NOT NULL';
	if (op.defaultValue) sql += ` DEFAULT ${op.defaultValue}`;
	return sql;
}

function generateDropColumn(
	op: Extract<MigrationOperation, { type: 'dropColumn' }>,
	_dialect: DatabaseDialect,
): string {
	return `ALTER TABLE "${op.table}" DROP COLUMN "${op.column}"`;
}

function generateAlterColumnType(
	op: Extract<MigrationOperation, { type: 'alterColumnType' }>,
	dialect: DatabaseDialect,
): string {
	if (dialect === 'sqlite') {
		// SQLite doesn't support ALTER COLUMN TYPE
		return `-- SQLite: Cannot alter column type for "${op.table}"."${op.column}" (${op.fromType} → ${op.toType}). Requires table rebuild.`;
	}
	const using = op.castExpression
		? ` USING ${op.castExpression}`
		: ` USING "${op.column}"::${op.toType}`;
	return `ALTER TABLE "${op.table}" ALTER COLUMN "${op.column}" TYPE ${op.toType}${using}`;
}

function generateAlterColumnNullable(
	op: Extract<MigrationOperation, { type: 'alterColumnNullable' }>,
	dialect: DatabaseDialect,
): string {
	if (dialect === 'sqlite') {
		return `-- SQLite: Cannot alter nullable for "${op.table}"."${op.column}". Requires table rebuild.`;
	}
	if (op.nullable) {
		return `ALTER TABLE "${op.table}" ALTER COLUMN "${op.column}" DROP NOT NULL`;
	}
	return `ALTER TABLE "${op.table}" ALTER COLUMN "${op.column}" SET NOT NULL`;
}

function generateAlterColumnDefault(
	op: Extract<MigrationOperation, { type: 'alterColumnDefault' }>,
	dialect: DatabaseDialect,
): string {
	if (dialect === 'sqlite') {
		return `-- SQLite: Cannot alter default for "${op.table}"."${op.column}". Requires table rebuild.`;
	}
	if (op.defaultValue === null) {
		return `ALTER TABLE "${op.table}" ALTER COLUMN "${op.column}" DROP DEFAULT`;
	}
	return `ALTER TABLE "${op.table}" ALTER COLUMN "${op.column}" SET DEFAULT ${op.defaultValue}`;
}

function generateAddForeignKey(
	op: Extract<MigrationOperation, { type: 'addForeignKey' }>,
	dialect: DatabaseDialect,
): string {
	if (dialect === 'sqlite') {
		return `-- SQLite: Cannot add FK "${op.constraintName}" after table creation. Requires table rebuild.`;
	}
	return `ALTER TABLE "${op.table}" ADD CONSTRAINT "${op.constraintName}" FOREIGN KEY ("${op.column}") REFERENCES "${op.referencedTable}"("${op.referencedColumn}") ON DELETE ${op.onDelete}`;
}

function generateDropForeignKey(
	op: Extract<MigrationOperation, { type: 'dropForeignKey' }>,
	dialect: DatabaseDialect,
): string {
	if (dialect === 'sqlite') {
		return `-- SQLite: Cannot drop FK "${op.constraintName}" after table creation. Requires table rebuild.`;
	}
	return `ALTER TABLE "${op.table}" DROP CONSTRAINT "${op.constraintName}"`;
}

function generateCreateIndex(
	op: Extract<MigrationOperation, { type: 'createIndex' }>,
): string {
	const unique = op.unique ? 'UNIQUE ' : '';
	const cols = op.columns.map((c) => `"${c}"`).join(', ');
	return `CREATE ${unique}INDEX IF NOT EXISTS "${op.indexName}" ON "${op.table}" (${cols})`;
}

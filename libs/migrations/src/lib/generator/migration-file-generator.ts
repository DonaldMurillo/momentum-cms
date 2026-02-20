/**
 * Migration File Generator
 *
 * Produces TypeScript migration file content from a SchemaDiffResult.
 * These files implement the MigrationFile interface (meta, up, down).
 */
import type { SchemaDiffResult } from '../schema/schema-diff';
import type { MigrationOperation } from '../operations/operation.types';
import type { DatabaseDialect } from '../schema/column-type-map';
import { operationsToUpSql, operationsToDownSql } from './sql-generator';

/**
 * Options for generating a migration file.
 */
export interface GenerateMigrationOptions {
	/** Migration name (used as filename and in meta) */
	name: string;
	/** Human-readable description */
	description?: string;
	/** Database dialect for SQL generation */
	dialect: DatabaseDialect;
}

/**
 * Generate a timestamp-prefixed migration name.
 * Format: YYYYMMDDHHMMSS_name
 */
export function generateMigrationName(name: string, timestamp?: Date): string {
	const d = timestamp ?? new Date();
	const pad = (n: number): string => String(n).padStart(2, '0');
	const prefix = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	return `${prefix}_${name}`;
}

/**
 * Generate the TypeScript content for a migration file.
 */
export function generateMigrationFileContent(
	diff: SchemaDiffResult,
	options: GenerateMigrationOptions,
): string {
	const { name, description, dialect } = options;
	const desc = description ?? (diff.summary.join('; ') || 'Auto-generated migration');

	const upStatements = operationsToUpSql(diff.operations, dialect);
	const downStatements = operationsToDownSql(diff.operations, dialect);

	const operationsMeta = serializeOperationsMeta(diff.operations);

	const lines: string[] = [];

	lines.push("import type { MigrationFile, MigrationContext } from '@momentumcms/migrations';");
	lines.push('');
	lines.push('export const meta: MigrationFile[\'meta\'] = {');
	lines.push(`\tname: ${JSON.stringify(name)},`);
	lines.push(`\tdescription: ${JSON.stringify(desc)},`);
	lines.push(`\toperations: ${operationsMeta},`);
	lines.push('};');
	lines.push('');

	// up function
	lines.push('export async function up(ctx: MigrationContext): Promise<void> {');
	for (const sql of upStatements) {
		if (sql.startsWith('--')) {
			lines.push(`\t// ${sql.slice(3)}`);
		} else {
			lines.push(`\tawait ctx.sql(${JSON.stringify(sql)});`);
		}
	}
	if (upStatements.length === 0) {
		lines.push('\t// No operations');
	}
	lines.push('}');
	lines.push('');

	// down function
	lines.push('export async function down(ctx: MigrationContext): Promise<void> {');
	for (const sql of downStatements) {
		if (sql.startsWith('--')) {
			lines.push(`\t// ${sql.slice(3)}`);
		} else {
			lines.push(`\tawait ctx.sql(${JSON.stringify(sql)});`);
		}
	}
	if (downStatements.length === 0) {
		lines.push('\t// Cannot reverse all operations');
	}
	lines.push('}');
	lines.push('');

	return lines.join('\n');
}

/**
 * Serialize operations metadata as a readable JSON array.
 * Only includes type + key fields for readability.
 */
function serializeOperationsMeta(operations: MigrationOperation[]): string {
	const simplified = operations.map((op) => {
		switch (op.type) {
			case 'createTable':
				return { type: op.type, table: op.table };
			case 'dropTable':
				return { type: op.type, table: op.table };
			case 'renameTable':
				return { type: op.type, from: op.from, to: op.to };
			case 'addColumn':
				return {
					type: op.type,
					table: op.table,
					column: op.column,
					nullable: op.nullable,
					defaultValue: op.defaultValue ?? null,
				};
			case 'dropColumn':
				return { type: op.type, table: op.table, column: op.column };
			case 'alterColumnType':
				return {
					type: op.type,
					table: op.table,
					column: op.column,
					fromType: op.fromType,
					toType: op.toType,
				};
			case 'alterColumnNullable':
				return { type: op.type, table: op.table, column: op.column, nullable: op.nullable };
			case 'alterColumnDefault':
				return { type: op.type, table: op.table, column: op.column };
			case 'renameColumn':
				return { type: op.type, table: op.table, from: op.from, to: op.to };
			case 'addForeignKey':
				return { type: op.type, table: op.table, constraintName: op.constraintName };
			case 'dropForeignKey':
				return { type: op.type, table: op.table, constraintName: op.constraintName };
			case 'createIndex':
				return { type: op.type, table: op.table, indexName: op.indexName };
			case 'dropIndex':
				return { type: op.type, table: op.table, indexName: op.indexName };
			case 'rawSql':
				return { type: op.type, description: op.description };
		}
	});
	return JSON.stringify(simplified, null, '\t');
}

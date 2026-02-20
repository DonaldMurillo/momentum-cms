/**
 * Dangerous Operation Detection
 *
 * Inspired by Rails' strong_migrations, analyzes migration operations
 * for patterns that could cause data loss, downtime, or failures.
 *
 * Each danger has a severity, a human-readable message, and a suggested fix.
 */
import type { MigrationOperation } from '../operations/operation.types';
import type { DatabaseDialect } from '../schema/column-type-map';

/**
 * Severity levels for dangerous operations.
 */
export type DangerSeverity = 'error' | 'warning' | 'info';

/**
 * A detected dangerous operation.
 */
export interface DangerWarning {
	/** Severity of the issue */
	severity: DangerSeverity;
	/** Which operation triggered this warning */
	operation: MigrationOperation;
	/** The index of the operation in the operations array */
	operationIndex: number;
	/** Human-readable description of the danger */
	message: string;
	/** Suggested alternative or fix */
	suggestion: string;
}

/**
 * Result of danger detection.
 */
export interface DangerDetectionResult {
	/** All detected warnings, ordered by severity (errors first) */
	warnings: DangerWarning[];
	/** Whether any errors were found (should block migration) */
	hasErrors: boolean;
	/** Whether any warnings were found */
	hasWarnings: boolean;
}

/**
 * Analyze migration operations for dangerous patterns.
 */
export function detectDangers(
	operations: MigrationOperation[],
	dialect: DatabaseDialect,
): DangerDetectionResult {
	const warnings: DangerWarning[] = [];

	for (let i = 0; i < operations.length; i++) {
		const op = operations[i];
		warnings.push(...checkOperation(op, i, operations, dialect));
	}

	// Sort: errors first, then warnings, then info
	const severityOrder: Record<DangerSeverity, number> = { error: 0, warning: 1, info: 2 };
	warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	return {
		warnings,
		hasErrors: warnings.some((w) => w.severity === 'error'),
		hasWarnings: warnings.some((w) => w.severity === 'warning'),
	};
}

/**
 * Check a single operation for dangerous patterns.
 */
function checkOperation(
	op: MigrationOperation,
	index: number,
	_allOps: MigrationOperation[],
	dialect: DatabaseDialect,
): DangerWarning[] {
	const warnings: DangerWarning[] = [];

	switch (op.type) {
		case 'dropTable':
			warnings.push({
				severity: 'error',
				operation: op,
				operationIndex: index,
				message: `Dropping table "${op.table}" will permanently delete all data.`,
				suggestion:
					'Consider renaming the table with a deprecation prefix (e.g., "_deprecated_") and scheduling deletion after verifying no data is needed.',
			});
			break;

		case 'dropColumn':
			warnings.push({
				severity: 'warning',
				operation: op,
				operationIndex: index,
				message: `Dropping column "${op.table}"."${op.column}" will permanently delete all values in this column.`,
				suggestion:
					'Before dropping, verify the column data is either migrated elsewhere or truly unneeded. Consider a backup or data export first.',
			});
			break;

		case 'alterColumnType':
			warnings.push(...checkTypeChange(op, index, dialect));
			break;

		case 'alterColumnNullable':
			if (!op.nullable) {
				warnings.push({
					severity: 'warning',
					operation: op,
					operationIndex: index,
					message: `Setting "${op.table}"."${op.column}" to NOT NULL may fail if existing rows contain NULL values.`,
					suggestion:
						'First backfill NULL values with a default (e.g., UPDATE table SET column = \'default\' WHERE column IS NULL), then add the NOT NULL constraint.',
				});
			}
			break;

		case 'addColumn':
			if (!op.nullable && !op.defaultValue) {
				warnings.push({
					severity: 'error',
					operation: op,
					operationIndex: index,
					message: `Adding NOT NULL column "${op.table}"."${op.column}" without a default value will fail if the table has existing rows.`,
					suggestion:
						'Either add a DEFAULT value, make the column nullable first and backfill, or add the column as nullable, backfill, then alter to NOT NULL.',
				});
			}
			break;

		case 'renameColumn':
			warnings.push({
				severity: 'warning',
				operation: op,
				operationIndex: index,
				message: `Renaming "${op.table}"."${op.from}" to "${op.to}" may break application code that references the old name.`,
				suggestion:
					'Deploy application code changes to use the new column name before or alongside the migration. Consider a phased approach: add new column, migrate data, update code, then drop old column.',
			});
			break;

		case 'renameTable':
			warnings.push({
				severity: 'warning',
				operation: op,
				operationIndex: index,
				message: `Renaming table "${op.from}" to "${op.to}" may break application code and queries.`,
				suggestion:
					'Update application code to use the new table name before or alongside the migration.',
			});
			break;

		case 'addForeignKey':
			if (dialect === 'postgresql') {
				warnings.push({
					severity: 'info',
					operation: op,
					operationIndex: index,
					message: `Adding foreign key "${op.constraintName}" acquires an ACCESS EXCLUSIVE lock on the referenced table.`,
					suggestion:
						'On large tables, consider adding the FK constraint with NOT VALID first, then validating separately: ALTER TABLE ... ADD CONSTRAINT ... NOT VALID; ALTER TABLE ... VALIDATE CONSTRAINT ...',
				});
			}
			break;

		case 'createIndex':
			if (dialect === 'postgresql' && !isCreateIndexConcurrent(op)) {
				warnings.push({
					severity: 'info',
					operation: op,
					operationIndex: index,
					message: `Creating index "${op.indexName}" will lock "${op.table}" for writes during index creation.`,
					suggestion:
						'For large tables, consider CREATE INDEX CONCURRENTLY to avoid blocking writes (requires running outside a transaction).',
				});
			}
			break;
	}

	return warnings;
}

/**
 * Check type change operations for dangerous patterns.
 */
function checkTypeChange(
	op: Extract<MigrationOperation, { type: 'alterColumnType' }>,
	index: number,
	dialect: DatabaseDialect,
): DangerWarning[] {
	const warnings: DangerWarning[] = [];

	if (dialect === 'sqlite') {
		warnings.push({
			severity: 'error',
			operation: op,
			operationIndex: index,
			message: `SQLite does not support ALTER COLUMN TYPE. Changing "${op.table}"."${op.column}" from ${op.fromType} to ${op.toType} requires a table rebuild.`,
			suggestion:
				'Create a new table with the desired schema, copy data, drop old table, and rename new table. Use a raw SQL migration for this.',
		});
		return warnings;
	}

	// Check for potentially lossy type conversions
	if (isLossyTypeChange(op.fromType, op.toType)) {
		warnings.push({
			severity: 'warning',
			operation: op,
			operationIndex: index,
			message: `Changing "${op.table}"."${op.column}" from ${op.fromType} to ${op.toType} may cause data loss or cast errors.`,
			suggestion:
				'Test the type conversion on a clone database first. Consider adding a USING clause with explicit cast logic.',
		});
	}

	// PostgreSQL ALTER TYPE rewrites the table for certain conversions
	if (isTableRewriteType(op.fromType, op.toType)) {
		warnings.push({
			severity: 'info',
			operation: op,
			operationIndex: index,
			message: `Changing "${op.table}"."${op.column}" from ${op.fromType} to ${op.toType} may require a table rewrite on large tables.`,
			suggestion:
				'On large tables, this can take significant time and lock the table. Consider running during low-traffic periods or using a phased approach.',
		});
	}

	return warnings;
}

/**
 * Detect potentially lossy type conversions.
 */
function isLossyTypeChange(from: string, to: string): boolean {
	const fromUpper = from.toUpperCase();
	const toUpper = to.toUpperCase();

	// Text to numeric types
	if (isTextType(fromUpper) && isNumericType(toUpper)) return true;

	// Wider to narrower numeric
	if (fromUpper === 'NUMERIC' && (toUpper === 'INTEGER' || toUpper === 'SMALLINT')) return true;
	if (fromUpper === 'BIGINT' && (toUpper === 'INTEGER' || toUpper === 'SMALLINT')) return true;
	if (fromUpper === 'DOUBLE PRECISION' && toUpper === 'REAL') return true;

	// JSONB/JSON to scalar
	if ((fromUpper === 'JSONB' || fromUpper === 'JSON') && !fromUpper.includes('JSON')) return true;

	// Timestamp to date (loses time info)
	if (fromUpper.includes('TIMESTAMP') && toUpper === 'DATE') return true;

	// VARCHAR(N) to smaller VARCHAR(M)
	const fromLength = extractLength(fromUpper);
	const toLength = extractLength(toUpper);
	if (fromLength && toLength && toLength < fromLength) return true;

	return false;
}

/**
 * Check if a type conversion requires a table rewrite in PostgreSQL.
 */
function isTableRewriteType(from: string, to: string): boolean {
	const fromUpper = from.toUpperCase();
	const toUpper = to.toUpperCase();

	// VARCHAR to TEXT is fine (no rewrite)
	if (fromUpper.startsWith('VARCHAR') && toUpper === 'TEXT') return false;
	// TEXT to VARCHAR may rewrite
	if (fromUpper === 'TEXT' && toUpper.startsWith('VARCHAR')) return true;
	// Most other type changes require rewrite
	if (isNumericType(fromUpper) !== isNumericType(toUpper)) return true;

	return false;
}

function isTextType(type: string): boolean {
	return type === 'TEXT' || type.startsWith('VARCHAR') || type.startsWith('CHAR');
}

function isNumericType(type: string): boolean {
	return ['INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 'FLOAT'].includes(
		type,
	);
}

function extractLength(type: string): number | null {
	const match = type.match(/\((\d+)\)/);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a createIndex operation uses CONCURRENTLY.
 * (Currently always returns false since our operations don't have this flag yet)
 */
function isCreateIndexConcurrent(
	_op: Extract<MigrationOperation, { type: 'createIndex' }>,
): boolean {
	return false;
}

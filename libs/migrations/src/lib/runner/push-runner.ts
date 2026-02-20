/**
 * Push Mode Runner
 *
 * Applies schema changes directly to the database without generating
 * migration files. Used in development for rapid iteration.
 *
 * Flow:
 * 1. Build desired schema from collections
 * 2. Introspect actual schema from database
 * 3. Diff them
 * 4. Run danger detection
 * 5. Generate and execute SQL statements
 */
import type { CollectionConfig } from '@momentumcms/core';
import type { DatabaseDialect } from '../schema/column-type-map';
import type { DatabaseSchemaSnapshot } from '../schema/schema-snapshot';
import type { SchemaDiffResult } from '../schema/schema-diff';
import type { DangerDetectionResult } from '../danger/danger-detector';
import { collectionsToSchema } from '../schema/collections-to-schema';
import { diffSchemas } from '../schema/schema-diff';
import { detectDangers } from '../danger/danger-detector';
import { operationsToUpSql } from '../generator/sql-generator';

/**
 * Query interface needed by the push runner.
 */
export interface PushRunnerDb {
	executeRaw(sql: string): Promise<number>;
}

/**
 * Options for the push runner.
 */
export interface PushRunnerOptions {
	/** Collections to sync */
	collections: CollectionConfig[];
	/** Database dialect */
	dialect: DatabaseDialect;
	/** Database query interface */
	db: PushRunnerDb;
	/** Function to introspect the current DB schema */
	introspect: () => Promise<DatabaseSchemaSnapshot>;
	/** If true, only report what would change without executing */
	dryRun?: boolean;
	/** If true, skip danger detection */
	skipDangerDetection?: boolean;
	/** Logger */
	log?: {
		info(msg: string): void;
		warn(msg: string): void;
	};
}

/**
 * Result of a push operation.
 */
export interface PushResult {
	/** Whether any changes were applied */
	applied: boolean;
	/** The diff result */
	diff: SchemaDiffResult;
	/** Danger detection result (null if skipped) */
	dangers: DangerDetectionResult | null;
	/** SQL statements that were executed (or would be in dry-run) */
	sqlStatements: string[];
	/** Number of successful statements */
	successCount: number;
	/** Errors encountered during execution */
	errors: Array<{ sql: string; error: string }>;
}

/**
 * Run push mode: directly apply schema changes to the database.
 */
export async function runPush(options: PushRunnerOptions): Promise<PushResult> {
	const { collections, dialect, db, introspect, dryRun, skipDangerDetection, log } = options;
	const noop = { info: (): void => { /* noop */ }, warn: (): void => { /* noop */ } };
	const logger = log ?? noop;

	// 1. Build desired schema
	const desired = collectionsToSchema(collections, dialect);

	// 2. Introspect actual schema
	const actual = await introspect();

	// 3. Diff
	const diff = diffSchemas(desired, actual, dialect);

	if (!diff.hasChanges) {
		logger.info('Schema is up to date. No changes needed.');
		return {
			applied: false,
			diff,
			dangers: null,
			sqlStatements: [],
			successCount: 0,
			errors: [],
		};
	}

	// 4. Danger detection
	let dangers: DangerDetectionResult | null = null;
	if (!skipDangerDetection) {
		dangers = detectDangers(diff.operations, dialect);
		if (dangers.hasErrors) {
			logger.warn(
				`Found ${dangers.warnings.filter((w) => w.severity === 'error').length} dangerous operations. Push blocked.`,
			);
			return {
				applied: false,
				diff,
				dangers,
				sqlStatements: [],
				successCount: 0,
				errors: [],
			};
		}
	}

	// 5. Generate SQL
	const sqlStatements = operationsToUpSql(diff.operations, dialect);

	if (dryRun) {
		logger.info(`Dry run: ${sqlStatements.length} statements would be executed.`);
		return {
			applied: false,
			diff,
			dangers,
			sqlStatements,
			successCount: 0,
			errors: [],
		};
	}

	// 6. Execute
	let successCount = 0;
	const errors: Array<{ sql: string; error: string }> = [];

	for (const sql of sqlStatements) {
		// Skip comments (SQLite limitation notes)
		if (sql.startsWith('--')) {
			logger.info(`Skipping: ${sql}`);
			continue;
		}

		try {
			await db.executeRaw(sql);
			successCount++;
			logger.info(`OK: ${sql.slice(0, 80)}${sql.length > 80 ? '...' : ''}`);
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			errors.push({ sql, error: errMsg });
			logger.warn(`FAILED: ${sql.slice(0, 80)} — ${errMsg}`);
		}
	}

	logger.info(
		`Push complete: ${successCount} applied, ${errors.length} failed out of ${sqlStatements.length} statements.`,
	);

	return {
		applied: successCount > 0,
		diff,
		dangers,
		sqlStatements,
		successCount,
		errors,
	};
}

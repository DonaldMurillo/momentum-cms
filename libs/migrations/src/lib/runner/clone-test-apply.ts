/**
 * Clone-Test-Apply Pipeline
 *
 * The crown jewel of the migration system. This pipeline:
 * 1. Clones the database
 * 2. Runs migrations on the clone
 * 3. Detects errors and generates fix suggestions
 * 4. If clone succeeds, applies to real database
 * 5. Cleans up the clone
 *
 * This ensures migrations are safe before touching production data.
 */
import type { MigrationContext } from '../migration.types';
import type { DatabaseDialect } from '../schema/column-type-map';
import type { TrackerQueryFn } from '../tracking/migration-tracker';
import type { LoadedMigration, MigrateResult } from './migrate-runner';
import { runMigrations } from './migrate-runner';
import type { DangerDetectionResult } from '../danger/danger-detector';

/**
 * Database interface needed for clone operations.
 */
export interface CloneCapableDb {
	/** Clone the database to a new instance */
	cloneDatabase(targetName: string): Promise<string>;
	/** Drop a cloned database */
	dropClone(targetName: string): Promise<void>;
}

/**
 * Options for the clone-test-apply pipeline.
 */
export interface CloneTestApplyOptions {
	/** All loaded migrations, in order */
	migrations: LoadedMigration[];
	/** Database dialect */
	dialect: DatabaseDialect;
	/** Tracker for the real database */
	tracker: TrackerQueryFn;
	/** Build a MigrationContext for the real database */
	buildContext: () => MigrationContext;
	/** Clone-capable database interface */
	db: CloneCapableDb;
	/** Build a TrackerQueryFn for the cloned database */
	buildCloneTracker: (cloneName: string) => TrackerQueryFn;
	/** Build a MigrationContext for the cloned database */
	buildCloneContext: (cloneName: string) => MigrationContext;
	/** If true, skip applying to real DB after clone test */
	testOnly?: boolean;
	/** If true, skip danger detection */
	skipDangerDetection?: boolean;
	/** Logger */
	log?: {
		info(msg: string): void;
		warn(msg: string): void;
	};
}

/**
 * Result of the clone-test-apply pipeline.
 */
export interface CloneTestApplyResult {
	/** Phase that was reached */
	phase: 'clone' | 'test' | 'apply' | 'complete' | 'skipped';
	/** Result from running migrations on the clone */
	cloneResult: MigrateResult | null;
	/** Result from running migrations on the real database */
	applyResult: MigrateResult | null;
	/** Danger detection result */
	dangers: DangerDetectionResult | null;
	/** Whether the clone was cleaned up */
	cloneCleanedUp: boolean;
	/** Name of the clone database (for debugging) */
	cloneName: string;
	/** Error that caused the pipeline to stop */
	error?: string;
	/** Suggested fixes if the clone test failed */
	suggestions: string[];
}

/**
 * Run the clone-test-apply pipeline.
 */
export async function cloneTestApply(
	options: CloneTestApplyOptions,
): Promise<CloneTestApplyResult> {
	const {
		migrations,
		dialect,
		tracker,
		buildContext,
		db,
		buildCloneTracker,
		buildCloneContext,
		testOnly,
		skipDangerDetection,
		log,
	} = options;
	const noop = { info: (): void => { /* noop */ }, warn: (): void => { /* noop */ } };
	const logger = log ?? noop;

	const timestamp = Date.now();
	const cloneName = `_mig_clone_${timestamp}`;
	let cloneCleanedUp = false;

	const result: CloneTestApplyResult = {
		phase: 'clone',
		cloneResult: null,
		applyResult: null,
		dangers: null,
		cloneCleanedUp: false,
		cloneName,
		suggestions: [],
	};

	try {
		// ============================================
		// Phase 1: Clone
		// ============================================
		logger.info(`Cloning database to "${cloneName}"...`);
		await db.cloneDatabase(cloneName);
		logger.info('Clone created successfully.');

		// ============================================
		// Phase 2: Test on clone
		// ============================================
		result.phase = 'test';
		logger.info('Running migrations on clone...');

		const cloneTracker = buildCloneTracker(cloneName);
		const cloneContext = buildCloneContext(cloneName);

		const cloneResult = await runMigrations({
			migrations,
			dialect,
			tracker: cloneTracker,
			buildContext: () => cloneContext,
			skipDangerDetection,
			log: {
				info: (msg: string) => logger.info(`[clone] ${msg}`),
				warn: (msg: string) => logger.warn(`[clone] ${msg}`),
			},
		});

		result.cloneResult = cloneResult;
		result.dangers = cloneResult.dangers;

		if (cloneResult.failCount > 0) {
			// Generate fix suggestions
			const suggestions = generateFixSuggestions(cloneResult);
			result.suggestions = suggestions;
			result.error = `Migration failed on clone: ${cloneResult.results.find((r) => !r.success)?.error}`;

			logger.warn('Migration failed on clone. Suggestions:');
			for (const suggestion of suggestions) {
				logger.warn(`  - ${suggestion}`);
			}

			// Clean up clone
			await cleanupClone(db, cloneName, logger);
			result.cloneCleanedUp = true;
			cloneCleanedUp = true;

			return result;
		}

		logger.info(`Clone test passed: ${cloneResult.successCount} migration(s) applied.`);

		// Clean up clone after successful test
		await cleanupClone(db, cloneName, logger);
		result.cloneCleanedUp = true;
		cloneCleanedUp = true;

		// ============================================
		// Phase 3: Apply to real database
		// ============================================
		if (testOnly) {
			result.phase = 'skipped';
			logger.info('Test-only mode: skipping real database apply.');
			return result;
		}

		result.phase = 'apply';
		logger.info('Applying migrations to real database...');

		const applyResult = await runMigrations({
			migrations,
			dialect,
			tracker,
			buildContext,
			skipDangerDetection: true, // Already validated on clone
			log: logger,
		});

		result.applyResult = applyResult;

		if (applyResult.failCount > 0) {
			result.error = `Migration failed on real database: ${applyResult.results.find((r) => !r.success)?.error}`;
			return result;
		}

		result.phase = 'complete';
		logger.info(
			`Pipeline complete: ${applyResult.successCount} migration(s) applied to real database.`,
		);

		return result;
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		result.error = errMsg;
		logger.warn(`Pipeline error: ${errMsg}`);

		// Attempt cleanup
		if (!cloneCleanedUp) {
			await cleanupClone(db, cloneName, logger);
			result.cloneCleanedUp = true;
		}

		return result;
	}
}

/**
 * Clean up a cloned database.
 */
async function cleanupClone(
	db: CloneCapableDb,
	cloneName: string,
	logger: { info(msg: string): void; warn(msg: string): void },
): Promise<void> {
	try {
		await db.dropClone(cloneName);
		logger.info(`Clone "${cloneName}" cleaned up.`);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		logger.warn(`Failed to clean up clone "${cloneName}": ${errMsg}`);
	}
}

/**
 * SQLSTATE error code → fix suggestion mapping.
 *
 * Using structured error codes from the database driver is far more reliable
 * than pattern-matching on error message strings, which vary by PG version,
 * locale, and driver.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const SQLSTATE_SUGGESTIONS: Record<string, string> = {
	// Class 23 — Integrity Constraint Violation
	'23502':
		'NOT NULL constraint violation. Backfill NULL values before adding the constraint: ' +
		'Use ctx.data.backfill(table, column, defaultValue) in a prior migration step.',
	'23505':
		'Unique constraint violation. Use ctx.data.dedup() to remove duplicates before adding the unique constraint.',
	'23503':
		'Foreign key constraint violation. Ensure referenced data exists before adding the constraint. ' +
		'Consider using ctx.data.backfill() to populate references, or add the FK with NOT VALID first.',
	// Class 42 — Syntax Error or Access Rule Violation
	'42P07':
		'The table already exists. Check if a previous migration already created it, ' +
		'or use IF NOT EXISTS in your DDL.',
	'42701':
		'The column already exists. Check if a previous migration already created it, ' +
		'or use IF NOT EXISTS in your DDL.',
	'42P01':
		'Referenced table does not exist. Check migration ordering — ' +
		'the table must be created before it can be referenced.',
	'42703':
		'Referenced column does not exist. Check migration ordering — ' +
		'the column must be created before it can be referenced.',
	// Class 22 — Data Exception
	'22P02':
		'Type conversion error. The data contains values that cannot be converted to the target type. ' +
		'Use ctx.data.transform() to clean up values before altering the column type.',
	'42804':
		'Type conversion error. Add an explicit USING clause for the type change, ' +
		'or use ctx.data.transform() to convert values before altering the column type.',
};

/**
 * Generate fix suggestions based on failed migration results.
 *
 * Uses SQLSTATE error codes when available (reliable, structured),
 * with a string-matching fallback for non-PG errors (SQLite, custom errors).
 */
function generateFixSuggestions(result: MigrateResult): string[] {
	const suggestions: string[] = [];
	const failedMigration = result.results.find((r) => !r.success);

	if (!failedMigration) return suggestions;

	// Prefer SQLSTATE error codes (structured, reliable)
	if (failedMigration.errorCode) {
		const codeSuggestion = SQLSTATE_SUGGESTIONS[failedMigration.errorCode];
		if (codeSuggestion) {
			suggestions.push(codeSuggestion);
			return suggestions;
		}
	}

	// Fallback: pattern matching on error message
	// (for SQLite, custom errors, or unknown SQLSTATE codes)
	const error = failedMigration.error ?? '';

	if (error.includes('NOT NULL') && error.includes('contains null')) {
		suggestions.push(
			'Backfill NULL values before adding NOT NULL constraint: ' +
			'Use ctx.data.backfill(table, column, defaultValue) in a prior migration step.',
		);
	}

	if (error.includes('already exists')) {
		suggestions.push(
			'The column or table already exists. Check if a previous migration already created it, ' +
			'or use IF NOT EXISTS in your DDL.',
		);
	}

	if (error.includes('violates foreign key')) {
		suggestions.push(
			'Foreign key constraint violation. Ensure referenced data exists before adding the constraint. ' +
			'Consider using ctx.data.backfill() to populate references, or add the FK with NOT VALID first.',
		);
	}

	if (error.includes('does not exist')) {
		suggestions.push(
			'Referenced table or column does not exist. Check migration ordering — ' +
			'the table/column must be created before it can be referenced.',
		);
	}

	if (error.includes('unique constraint') || error.includes('duplicate key')) {
		suggestions.push(
			'Unique constraint violation. Use ctx.data.dedup() to remove duplicates before adding the unique constraint.',
		);
	}

	if (error.includes('type') && (error.includes('cast') || error.includes('convert'))) {
		suggestions.push(
			'Type conversion error. Add an explicit USING clause for the type change, ' +
			'or use ctx.data.transform() to convert values before altering the column type.',
		);
	}

	if (suggestions.length === 0) {
		suggestions.push(
			`Migration "${failedMigration.name}" failed with: ${error}. ` +
			'Review the migration SQL and test on a development database.',
		);
	}

	return suggestions;
}

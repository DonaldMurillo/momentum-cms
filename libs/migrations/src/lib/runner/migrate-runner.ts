/**
 * Migrate Mode Runner
 *
 * Runs migration files in order, tracking which have been applied.
 * Supports forward migration, rollback by batch, and status checking.
 */
import type { MigrationFile, MigrationContext } from '../migration.types';
import type { DatabaseDialect } from '../schema/column-type-map';
import type { TrackerQueryFn } from '../tracking/migration-tracker';
import {
	ensureTrackingTable,
	getAppliedMigrations,
	getNextBatchNumber,
	recordMigration,
	removeMigrationRecord,
	getMigrationsByBatch,
	getLatestBatchNumber,
} from '../tracking/migration-tracker';
import { detectDangers } from '../danger/danger-detector';
import type { DangerDetectionResult } from '../danger/danger-detector';
import type { MigrationOperation } from '../operations/operation.types';
import { createHash } from 'node:crypto';

/**
 * A loaded migration with its file content.
 */
export interface LoadedMigration {
	/** Migration name (filename without extension) */
	name: string;
	/** The migration file exports */
	file: MigrationFile;
}

/**
 * Result of running a single migration.
 */
export interface MigrationRunResult {
	name: string;
	success: boolean;
	executionMs: number;
	error?: string;
	/** SQLSTATE error code from the database driver (e.g., '23505' for unique_violation) */
	errorCode?: string;
}

/**
 * Result of running all pending migrations.
 */
export interface MigrateResult {
	/** Batch number assigned to these migrations */
	batch: number;
	/** Results for each migration that was run */
	results: MigrationRunResult[];
	/** Number of successful migrations */
	successCount: number;
	/** Number of failed migrations */
	failCount: number;
	/** Danger detection result (null if skipped) */
	dangers: DangerDetectionResult | null;
}

/**
 * Options for the migrate runner.
 */
export interface MigrateRunnerOptions {
	/** All loaded migrations, in order */
	migrations: LoadedMigration[];
	/** Database dialect */
	dialect: DatabaseDialect;
	/** Tracker DB interface */
	tracker: TrackerQueryFn;
	/** Build a MigrationContext for executing migrations */
	buildContext: () => MigrationContext;
	/** If true, skip danger detection */
	skipDangerDetection?: boolean;
	/** Logger */
	log?: {
		info(msg: string): void;
		warn(msg: string): void;
	};
}

/**
 * Run all pending migrations forward.
 */
export async function runMigrations(options: MigrateRunnerOptions): Promise<MigrateResult> {
	const { migrations, dialect, tracker, buildContext, skipDangerDetection, log } = options;
	const noop = { info: (): void => { /* noop */ }, warn: (): void => { /* noop */ } };
	const logger = log ?? noop;

	// Ensure tracking table exists
	await ensureTrackingTable(tracker, dialect);

	// Get applied migrations
	const applied = await getAppliedMigrations(tracker);
	const appliedNames = new Set(applied.map((m) => m.name));

	// Filter to pending
	const pending = migrations.filter((m) => !appliedNames.has(m.name));

	if (pending.length === 0) {
		logger.info('No pending migrations.');
		return {
			batch: 0,
			results: [],
			successCount: 0,
			failCount: 0,
			dangers: null,
		};
	}

	// Danger detection on pending migrations
	let dangers: DangerDetectionResult | null = null;
	if (!skipDangerDetection) {
		const allOps: MigrationOperation[] = pending.flatMap(
			(m) => {
				const ops = m.file.meta.operations;
				if (!ops) return [];
				// Operations from meta are structurally compatible with MigrationOperation
				const typed: MigrationOperation[] = ops.filter(
					(op): op is MigrationOperation => typeof op.type === 'string',
				);
				return typed;
			},
		);
		if (allOps.length > 0) {
			dangers = detectDangers(allOps, dialect);
			if (dangers.hasErrors) {
				logger.warn('Dangerous operations detected. Migration blocked.');
				return {
					batch: 0,
					results: [],
					successCount: 0,
					failCount: 0,
					dangers,
				};
			}
		}
	}

	// Get next batch number
	const batch = await getNextBatchNumber(tracker);
	logger.info(`Running ${pending.length} migration(s) in batch ${batch}...`);

	const results: MigrationRunResult[] = [];
	const ctx = buildContext();

	for (const migration of pending) {
		const start = Date.now();
		try {
			await migration.file.up(ctx);
			const executionMs = Date.now() - start;

			// Record success
			const checksum = computeMigrationChecksum(migration);
			await recordMigration(
				tracker,
				{
					name: migration.name,
					batch,
					checksum,
					appliedAt: new Date().toISOString(),
					executionMs,
				},
				dialect,
			);

			results.push({ name: migration.name, success: true, executionMs });
			logger.info(`  OK: ${migration.name} (${executionMs}ms)`);
		} catch (err) {
			const executionMs = Date.now() - start;
			const errMsg = err instanceof Error ? err.message : String(err);
			const errorCode = extractErrorCode(err);
			results.push({ name: migration.name, success: false, executionMs, error: errMsg, errorCode });
			logger.warn(`  FAILED: ${migration.name} — ${errMsg}`);
			// Stop on first failure
			break;
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failCount = results.filter((r) => !r.success).length;

	logger.info(
		`Batch ${batch}: ${successCount} applied, ${failCount} failed.`,
	);

	return { batch, results, successCount, failCount, dangers };
}

/**
 * Rollback the latest batch of migrations.
 */
export async function rollbackBatch(options: MigrateRunnerOptions): Promise<MigrateResult> {
	const { migrations, dialect, tracker, buildContext, log } = options;
	const noop = { info: (): void => { /* noop */ }, warn: (): void => { /* noop */ } };
	const logger = log ?? noop;

	await ensureTrackingTable(tracker, dialect);

	const latestBatch = await getLatestBatchNumber(tracker);
	if (latestBatch === 0) {
		logger.info('Nothing to rollback.');
		return { batch: 0, results: [], successCount: 0, failCount: 0, dangers: null };
	}

	const batchMigrations = await getMigrationsByBatch(tracker, latestBatch, dialect);
	if (batchMigrations.length === 0) {
		logger.info('No migrations in latest batch.');
		return { batch: 0, results: [], successCount: 0, failCount: 0, dangers: null };
	}

	logger.info(
		`Rolling back batch ${latestBatch} (${batchMigrations.length} migration(s))...`,
	);

	const migrationMap = new Map(migrations.map((m) => [m.name, m]));
	const results: MigrationRunResult[] = [];
	const ctx = buildContext();

	// Run down() in reverse order
	for (const record of batchMigrations) {
		const migration = migrationMap.get(record.name);
		if (!migration) {
			results.push({
				name: record.name,
				success: false,
				executionMs: 0,
				error: `Migration file "${record.name}" not found`,
			});
			logger.warn(`  MISSING: ${record.name}`);
			break;
		}

		const start = Date.now();
		try {
			await migration.file.down(ctx);
			const executionMs = Date.now() - start;

			await removeMigrationRecord(tracker, record.name, dialect);
			results.push({ name: record.name, success: true, executionMs });
			logger.info(`  Rolled back: ${record.name} (${executionMs}ms)`);
		} catch (err) {
			const executionMs = Date.now() - start;
			const errMsg = err instanceof Error ? err.message : String(err);
			const errorCode = extractErrorCode(err);
			results.push({ name: record.name, success: false, executionMs, error: errMsg, errorCode });
			logger.warn(`  FAILED rollback: ${record.name} — ${errMsg}`);
			break;
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failCount = results.filter((r) => !r.success).length;

	return { batch: latestBatch, results, successCount, failCount, dangers: null };
}

/**
 * Get migration status: which are applied, which are pending.
 */
export interface MigrationStatusEntry {
	name: string;
	status: 'applied' | 'pending';
	batch?: number;
	appliedAt?: string;
}

export async function getMigrationStatus(
	migrations: LoadedMigration[],
	tracker: TrackerQueryFn,
	dialect: DatabaseDialect,
): Promise<MigrationStatusEntry[]> {
	await ensureTrackingTable(tracker, dialect);
	const applied = await getAppliedMigrations(tracker);
	const appliedMap = new Map(applied.map((m) => [m.name, m]));

	return migrations.map((m): MigrationStatusEntry => {
		const record = appliedMap.get(m.name);
		if (record) {
			return {
				name: m.name,
				status: 'applied',
				batch: record.batch,
				appliedAt: record.appliedAt,
			};
		}
		return { name: m.name, status: 'pending' };
	});
}

/**
 * Extract a SQLSTATE error code from a database driver error.
 * PG driver puts the code on `err.code` (e.g., '23505' for unique_violation).
 */
function extractErrorCode(err: unknown): string | undefined {
	if (err !== null && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
		return err.code;
	}
	return undefined;
}

/**
 * Compute a checksum for a migration file (for drift detection).
 */
function computeMigrationChecksum(migration: LoadedMigration): string {
	// Hash the stringified up + down functions and meta
	const content = JSON.stringify(migration.file.meta) +
		migration.file.up.toString() +
		migration.file.down.toString();
	return createHash('sha256').update(content).digest('hex');
}

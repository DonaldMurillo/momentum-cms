/**
 * @momentumcms/migrations
 *
 * Database migration system for Momentum CMS.
 * Provides schema introspection, diffing, generation, and execution.
 */

// Schema
export * from './lib/schema/schema-snapshot';
export * from './lib/schema/column-type-map';
export { introspectPostgres } from './lib/schema/introspect-postgres';
export type { QueryFunction } from './lib/schema/introspect-postgres';
export { introspectSqlite } from './lib/schema/introspect-sqlite';
export type { SqliteQueryFunction } from './lib/schema/introspect-sqlite';
export { collectionToTableSnapshot, collectionsToSchema } from './lib/schema/collections-to-schema';
export { diffSchemas } from './lib/schema/schema-diff';
export type { SchemaDiffOptions, SchemaDiffResult } from './lib/schema/schema-diff';

// Operations
export * from './lib/operations/operation.types';

// Generator
export {
	operationToSql,
	operationToReverseSql,
	operationsToUpSql,
	operationsToDownSql,
} from './lib/generator/sql-generator';
export {
	generateMigrationName,
	generateMigrationFileContent,
} from './lib/generator/migration-file-generator';
export type { GenerateMigrationOptions } from './lib/generator/migration-file-generator';

// Tracking
export {
	ensureTrackingTable,
	getAppliedMigrations,
	getNextBatchNumber,
	recordMigration,
	removeMigrationRecord,
	getMigrationsByBatch,
	getLatestBatchNumber,
	isMigrationApplied,
} from './lib/tracking/migration-tracker';
export type { TrackerQueryFn } from './lib/tracking/migration-tracker';

// Danger Detection
export { detectDangers } from './lib/danger/danger-detector';
export type {
	DangerSeverity,
	DangerWarning,
	DangerDetectionResult,
} from './lib/danger/danger-detector';

// Runner
export { runPush } from './lib/runner/push-runner';
export type { PushRunnerDb, PushRunnerOptions, PushResult } from './lib/runner/push-runner';
export { runMigrations, rollbackBatch, getMigrationStatus } from './lib/runner/migrate-runner';
export type {
	LoadedMigration,
	MigrationRunResult,
	MigrateResult,
	MigrateRunnerOptions,
	MigrationStatusEntry,
} from './lib/runner/migrate-runner';

// Clone-Test-Apply Pipeline
export { cloneTestApply } from './lib/runner/clone-test-apply';
export type {
	CloneCapableDb,
	CloneTestApplyOptions,
	CloneTestApplyResult,
} from './lib/runner/clone-test-apply';

// Data Helpers
export { createDataHelpers } from './lib/helpers/data-helpers';
export type { DataHelperDb } from './lib/helpers/data-helpers';

// Loader
export { loadMigrationsFromDisk } from './lib/loader/migration-loader';
export { readSnapshot, writeSnapshot, getSnapshotPath } from './lib/loader/snapshot-manager';

// CLI Shared (for programmatic use)
export {
	resolveDialect,
	buildTrackerFromAdapter,
	buildContextFromAdapter,
	buildPushDbFromAdapter,
	buildCloneDbFromAdapter,
	buildIntrospector,
	parseMigrationArgs,
} from './cli/shared';
export type { MigrationCliArgs } from './cli/shared';

// Types
export * from './lib/migration.types';

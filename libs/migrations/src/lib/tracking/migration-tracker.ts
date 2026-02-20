/**
 * Migration Tracker
 *
 * Manages the _momentum_migrations tracking table.
 * Records which migrations have been applied, their batch numbers,
 * checksums, and execution times.
 */
import { MIGRATION_TRACKING_TABLE } from '../migration.types';
import type { MigrationTrackingRecord } from '../migration.types';
import type { DatabaseDialect } from '../schema/column-type-map';

/**
 * Database query function type.
 * Abstracts the adapter's queryRaw / executeRaw methods.
 */
export interface TrackerQueryFn {
	query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
	execute(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * Ensure the migration tracking table exists.
 */
export async function ensureTrackingTable(
	db: TrackerQueryFn,
	dialect: DatabaseDialect,
): Promise<void> {
	if (dialect === 'postgresql') {
		await db.execute(`
			CREATE TABLE IF NOT EXISTS "${MIGRATION_TRACKING_TABLE}" (
				"id" VARCHAR(36) PRIMARY KEY,
				"name" VARCHAR(255) NOT NULL UNIQUE,
				"batch" INTEGER NOT NULL,
				"checksum" VARCHAR(64) NOT NULL,
				"appliedAt" TIMESTAMPTZ NOT NULL,
				"executionMs" INTEGER NOT NULL
			)
		`);
	} else {
		await db.execute(`
			CREATE TABLE IF NOT EXISTS "${MIGRATION_TRACKING_TABLE}" (
				"id" TEXT PRIMARY KEY,
				"name" TEXT NOT NULL UNIQUE,
				"batch" INTEGER NOT NULL,
				"checksum" TEXT NOT NULL,
				"appliedAt" TEXT NOT NULL,
				"executionMs" INTEGER NOT NULL
			)
		`);
	}
}

/**
 * Get all applied migrations, ordered by batch and name.
 */
export async function getAppliedMigrations(
	db: TrackerQueryFn,
): Promise<MigrationTrackingRecord[]> {
	const rows = await db.query<MigrationTrackingRecord & { [key: string]: unknown }>(
		`SELECT * FROM "${MIGRATION_TRACKING_TABLE}" ORDER BY "batch" ASC, "name" ASC`,
	);
	return rows.map(toTrackingRecord);
}

/**
 * Get the next batch number.
 */
export async function getNextBatchNumber(db: TrackerQueryFn): Promise<number> {
	const rows = await db.query<{ max_batch: number | null; [key: string]: unknown }>(
		`SELECT MAX("batch") as max_batch FROM "${MIGRATION_TRACKING_TABLE}"`,
	);
	const maxBatch = rows[0]?.max_batch;
	return (typeof maxBatch === 'number' ? maxBatch : 0) + 1;
}

/**
 * Record a migration as applied.
 */
export async function recordMigration(
	db: TrackerQueryFn,
	record: Omit<MigrationTrackingRecord, 'id'>,
	dialect: DatabaseDialect,
): Promise<MigrationTrackingRecord> {
	const id = generateUUID();
	const full: MigrationTrackingRecord = { id, ...record };

	if (dialect === 'postgresql') {
		await db.execute(
			`INSERT INTO "${MIGRATION_TRACKING_TABLE}" ("id", "name", "batch", "checksum", "appliedAt", "executionMs")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[full.id, full.name, full.batch, full.checksum, full.appliedAt, full.executionMs],
		);
	} else {
		await db.execute(
			`INSERT INTO "${MIGRATION_TRACKING_TABLE}" ("id", "name", "batch", "checksum", "appliedAt", "executionMs")
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[full.id, full.name, full.batch, full.checksum, full.appliedAt, full.executionMs],
		);
	}

	return full;
}

/**
 * Remove a migration record (for rollbacks).
 */
export async function removeMigrationRecord(
	db: TrackerQueryFn,
	name: string,
	dialect: DatabaseDialect,
): Promise<boolean> {
	const placeholder = dialect === 'postgresql' ? '$1' : '?';
	const affected = await db.execute(
		`DELETE FROM "${MIGRATION_TRACKING_TABLE}" WHERE "name" = ${placeholder}`,
		[name],
	);
	return affected > 0;
}

/**
 * Get migrations from a specific batch (for rollback).
 */
export async function getMigrationsByBatch(
	db: TrackerQueryFn,
	batch: number,
	dialect: DatabaseDialect,
): Promise<MigrationTrackingRecord[]> {
	const placeholder = dialect === 'postgresql' ? '$1' : '?';
	const rows = await db.query<MigrationTrackingRecord & { [key: string]: unknown }>(
		`SELECT * FROM "${MIGRATION_TRACKING_TABLE}" WHERE "batch" = ${placeholder} ORDER BY "name" DESC`,
		[batch],
	);
	return rows.map(toTrackingRecord);
}

/**
 * Get the latest batch number.
 */
export async function getLatestBatchNumber(db: TrackerQueryFn): Promise<number> {
	const rows = await db.query<{ max_batch: number | null; [key: string]: unknown }>(
		`SELECT MAX("batch") as max_batch FROM "${MIGRATION_TRACKING_TABLE}"`,
	);
	return typeof rows[0]?.max_batch === 'number' ? rows[0].max_batch : 0;
}

/**
 * Check if a specific migration has been applied.
 */
export async function isMigrationApplied(
	db: TrackerQueryFn,
	name: string,
	dialect: DatabaseDialect,
): Promise<boolean> {
	const placeholder = dialect === 'postgresql' ? '$1' : '?';
	const rows = await db.query<{ cnt: number; [key: string]: unknown }>(
		`SELECT COUNT(*) as cnt FROM "${MIGRATION_TRACKING_TABLE}" WHERE "name" = ${placeholder}`,
		[name],
	);
	return (rows[0]?.cnt ?? 0) > 0;
}

// ============================================
// Internal helpers
// ============================================

function toTrackingRecord(row: Record<string, unknown>): MigrationTrackingRecord {
	return {
		id: String(row['id']),
		name: String(row['name']),
		batch: Number(row['batch']),
		checksum: String(row['checksum']),
		appliedAt: String(row['appliedAt']),
		executionMs: Number(row['executionMs']),
	};
}

function generateUUID(): string {
	// Simple UUID v4 for tracking records
	const crypto: typeof import('node:crypto') = require('node:crypto');
	return crypto.randomUUID();
}

/**
 * Snapshot Manager
 *
 * Manages the .snapshot.json file that tracks the "last known" database
 * schema state. The generate command uses this to diff against the desired
 * schema from collections, avoiding the need for a live DB connection.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSchemaSnapshot } from '../schema/schema-snapshot';
import { serializeSnapshot, deserializeSnapshot } from '../schema/schema-snapshot';

const SNAPSHOT_FILENAME = '.snapshot.json';

/**
 * Pattern for per-migration snapshot files: YYYYMMDDHHMMSS_name.snapshot.json
 */
const PER_MIGRATION_SNAPSHOT_PATTERN = /^\d{14}_.+\.snapshot\.json$/;

/**
 * Read the schema snapshot from the migrations directory.
 * Prefers per-migration snapshots (latest by timestamp) over the legacy .snapshot.json.
 * Returns null if no snapshot file exists.
 */
export function readSnapshot(directory: string): DatabaseSchemaSnapshot | null {
	// Prefer per-migration snapshots
	const perMigration = findLatestPerMigrationSnapshot(directory);
	if (perMigration) return perMigration;

	// Fallback: legacy .snapshot.json
	const filePath = join(directory, SNAPSHOT_FILENAME);
	if (!existsSync(filePath)) return null;

	const json = readFileSync(filePath, 'utf-8');
	return deserializeSnapshot(json);
}

/**
 * Write a schema snapshot to the migrations directory.
 * Creates the directory if it doesn't exist.
 */
export function writeSnapshot(directory: string, snapshot: DatabaseSchemaSnapshot): void {
	mkdirSync(directory, { recursive: true });
	const filePath = join(directory, SNAPSHOT_FILENAME);
	writeFileSync(filePath, serializeSnapshot(snapshot), 'utf-8');
}

/**
 * Write a per-migration snapshot alongside its migration file.
 * Creates a file named `{migrationName}.snapshot.json` in the directory.
 */
export function writePerMigrationSnapshot(
	directory: string,
	migrationName: string,
	snapshot: DatabaseSchemaSnapshot,
): void {
	mkdirSync(directory, { recursive: true });
	const filePath = join(directory, `${migrationName}.snapshot.json`);
	writeFileSync(filePath, serializeSnapshot(snapshot), 'utf-8');
}

/**
 * Find the latest per-migration snapshot in the directory.
 * Scans for files matching YYYYMMDDHHMMSS_name.snapshot.json,
 * sorts lexicographically (timestamp prefix ensures correct order),
 * and returns the last one.
 */
export function findLatestPerMigrationSnapshot(directory: string): DatabaseSchemaSnapshot | null {
	if (!existsSync(directory)) return null;

	const snapshotFiles = readdirSync(directory)
		.filter((f) => PER_MIGRATION_SNAPSHOT_PATTERN.test(f))
		.sort();

	if (snapshotFiles.length === 0) return null;

	const latestFile = snapshotFiles[snapshotFiles.length - 1];
	const json = readFileSync(join(directory, latestFile), 'utf-8');
	return deserializeSnapshot(json);
}

/**
 * Get the full path to the snapshot file.
 */
export function getSnapshotPath(directory: string): string {
	return join(directory, SNAPSHOT_FILENAME);
}

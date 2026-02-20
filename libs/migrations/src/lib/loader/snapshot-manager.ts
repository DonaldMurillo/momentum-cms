/**
 * Snapshot Manager
 *
 * Manages the .snapshot.json file that tracks the "last known" database
 * schema state. The generate command uses this to diff against the desired
 * schema from collections, avoiding the need for a live DB connection.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSchemaSnapshot } from '../schema/schema-snapshot';
import { serializeSnapshot, deserializeSnapshot } from '../schema/schema-snapshot';

const SNAPSHOT_FILENAME = '.snapshot.json';

/**
 * Read the schema snapshot from the migrations directory.
 * Returns null if no snapshot file exists.
 */
export function readSnapshot(directory: string): DatabaseSchemaSnapshot | null {
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
 * Get the full path to the snapshot file.
 */
export function getSnapshotPath(directory: string): string {
	return join(directory, SNAPSHOT_FILENAME);
}

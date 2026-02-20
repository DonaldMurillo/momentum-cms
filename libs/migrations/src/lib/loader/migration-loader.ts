/**
 * Migration Loader
 *
 * Scans a directory for .ts migration files, dynamically imports them,
 * and returns LoadedMigration[] sorted by timestamp prefix.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MigrationFile } from '../migration.types';
import type { LoadedMigration } from '../runner/migrate-runner';

/**
 * Pattern for migration filenames: YYYYMMDDHHMMSS_name.ts
 */
const MIGRATION_FILE_PATTERN = /^\d{14}_.+\.ts$/;

/**
 * Type guard for MigrationFile.
 */
function isMigrationFile(value: unknown): value is MigrationFile {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value;
	return (
		'meta' in obj &&
		typeof obj['meta'] === 'object' &&
		obj['meta'] !== null &&
		'up' in obj &&
		typeof obj['up'] === 'function' &&
		'down' in obj &&
		typeof obj['down'] === 'function'
	);
}

function validateMigrationModule(
	mod: Record<string, unknown>,
	filePath: string,
): MigrationFile {
	const file: unknown = mod['default'] ?? mod;

	if (!isMigrationFile(file)) {
		if (typeof file !== 'object' || file === null) {
			throw new Error(`Migration file ${filePath} does not export a valid module`);
		}
		if (!('meta' in file) || typeof file['meta'] !== 'object') {
			throw new Error(`Migration file ${filePath} is missing a valid 'meta' export`);
		}
		if (!('up' in file) || typeof file['up'] !== 'function') {
			throw new Error(`Migration file ${filePath} is missing an 'up' function export`);
		}
		if (!('down' in file) || typeof file['down'] !== 'function') {
			throw new Error(`Migration file ${filePath} is missing a 'down' function export`);
		}
		throw new Error(`Migration file ${filePath} does not conform to MigrationFile interface`);
	}

	return file;
}

/**
 * Load all migration files from a directory.
 *
 * Scans for `.ts` files matching the YYYYMMDDHHMMSS_name.ts pattern,
 * dynamically imports each one, validates the exports, and returns
 * them sorted by filename (timestamp prefix ensures correct order).
 *
 * @returns Sorted array of loaded migrations (empty if directory is missing/empty)
 */
export async function loadMigrationsFromDisk(directory: string): Promise<LoadedMigration[]> {
	if (!existsSync(directory)) return [];

	const files = readdirSync(directory)
		.filter((f) => MIGRATION_FILE_PATTERN.test(f))
		.sort();

	if (files.length === 0) return [];

	const migrations: LoadedMigration[] = [];

	for (const filename of files) {
		const filePath = join(directory, filename);
		const fileUrl = pathToFileURL(filePath).href;
		const mod: Record<string, unknown> = await import(fileUrl);
		const file = validateMigrationModule(mod, filePath);
		const name = filename.replace(/\.ts$/, '');

		migrations.push({ name, file });
	}

	return migrations;
}

/**
 * Migration Rollback CLI
 *
 * Rolls back the latest batch of applied migrations.
 *
 * Usage: npx tsx rollback.ts <configPath>
 */
import { resolve } from 'node:path';
import { resolveMigrationConfig } from '@momentumcms/core';
import { loadMigrationsFromDisk } from '../lib/loader/migration-loader';
import { rollbackBatch } from '../lib/runner/migrate-runner';
import {
	loadMomentumConfig,
	resolveDialect,
	buildTrackerFromAdapter,
	buildContextFromAdapter,
	parseMigrationArgs,
} from './shared';

async function main(): Promise<void> {
	const args = parseMigrationArgs(process.argv.slice(2));
	const config = await loadMomentumConfig(resolve(args.configPath));
	const adapter = config.db.adapter;
	const dialect = resolveDialect(adapter);
	const migrationConfig = resolveMigrationConfig(config.migrations ?? {});

	if (!migrationConfig) {
		console.warn('No migration config found.');
		process.exit(1);
	}

	const directory = resolve(migrationConfig.directory);
	const migrations = await loadMigrationsFromDisk(directory);

	if (migrations.length === 0) {
		console.warn('No migration files found in', directory);
		return;
	}

	const tracker = buildTrackerFromAdapter(adapter);
	const buildContext = (): ReturnType<typeof buildContextFromAdapter> =>
		buildContextFromAdapter(adapter, dialect);

	const log = {
		info: (msg: string): void => console.warn(`[migration] ${msg}`),
		warn: (msg: string): void => console.warn(`[migration:warn] ${msg}`),
	};

	const result = await rollbackBatch({
		migrations,
		dialect,
		tracker,
		buildContext,
		log,
	});

	if (result.batch === 0) {
		console.warn('Nothing to rollback.');
		return;
	}

	console.warn(`\nRolled back batch ${result.batch}: ${result.successCount} migration(s)`);
	if (result.failCount > 0) {
		console.error(`Failed: ${result.failCount} migration(s)`);
		for (const r of result.results) {
			if (!r.success) {
				console.error(`  ${r.name}: ${r.error}`);
			}
		}
		process.exit(1);
	}
}

main().catch((err: unknown) => {
	console.error('Migration rollback failed:', err);
	process.exit(1);
});

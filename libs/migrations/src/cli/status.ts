/**
 * Migration Status CLI
 *
 * Shows the status of all migration files: applied or pending.
 *
 * Usage: npx tsx status.ts <configPath>
 */
import { resolve } from 'node:path';
import { resolveMigrationConfig } from '@momentumcms/core';
import { loadMigrationsFromDisk } from '../lib/loader/migration-loader';
import { getMigrationStatus } from '../lib/runner/migrate-runner';
import {
	loadMomentumConfig,
	resolveDialect,
	buildTrackerFromAdapter,
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
	const entries = await getMigrationStatus(migrations, tracker, dialect);

	const appliedCount = entries.filter((e) => e.status === 'applied').length;
	const pendingCount = entries.filter((e) => e.status === 'pending').length;

	console.warn(`\nMigration Status (${appliedCount} applied, ${pendingCount} pending)\n`);
	console.warn('  Name'.padEnd(50) + 'Status'.padEnd(12) + 'Batch'.padEnd(8) + 'Applied At');
	console.warn('  ' + '-'.repeat(80));

	for (const entry of entries) {
		const name = `  ${entry.name}`.padEnd(50);
		const status = entry.status.padEnd(12);
		const batch = (entry.batch?.toString() ?? '-').padEnd(8);
		const appliedAt = entry.appliedAt ?? '-';
		console.warn(`${name}${status}${batch}${appliedAt}`);
	}

	console.warn('');
}

main().catch((err: unknown) => {
	console.error('Migration status failed:', err);
	process.exit(1);
});

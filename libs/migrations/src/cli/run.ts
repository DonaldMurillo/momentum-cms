/**
 * Migration Run CLI
 *
 * Loads migration files from disk and applies pending ones.
 * Optionally uses clone-test-apply safety pipeline (PG only).
 *
 * Usage: npx tsx run.ts <configPath> [--test-only] [--skip-clone-test]
 */
import { resolve } from 'node:path';
import { resolveMigrationConfig } from '@momentumcms/core';
import { loadMigrationsFromDisk } from '../lib/loader/migration-loader';
import { runMigrations } from '../lib/runner/migrate-runner';
import { cloneTestApply } from '../lib/runner/clone-test-apply';
import {
	loadMomentumConfig,
	resolveDialect,
	buildTrackerFromAdapter,
	buildContextFromAdapter,
	buildCloneDbFromAdapter,
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

	const useCloneTest =
		!args.skipCloneTest && migrationConfig.cloneTest && dialect === 'postgresql';

	if (useCloneTest) {
		// Clone-test-apply pipeline
		const db = buildCloneDbFromAdapter(adapter);

		const result = await cloneTestApply({
			migrations,
			dialect,
			tracker,
			buildContext,
			db,
			buildCloneTracker: (_cloneName: string) => tracker,
			buildCloneContext: (_cloneName: string) => buildContext(),
			testOnly: args.testOnly,
			log,
		});

		console.warn(`\nClone test: ${result.cloneSuccess ? 'PASSED' : 'FAILED'}`);

		if (!result.cloneSuccess && result.cloneError) {
			console.error(`Clone error: ${result.cloneError}`);
			if (result.suggestion) {
				console.warn(`Suggestion: ${result.suggestion}`);
			}
		}

		if (result.applied) {
			console.warn(`Applied: ${result.applied.successCount} migration(s) in batch ${result.applied.batch}`);
			if (result.applied.failCount > 0) {
				console.error(`Failed: ${result.applied.failCount} migration(s)`);
			}
		}

		if (!result.cloneSuccess) {
			process.exit(1);
		}
	} else {
		// Direct run (no clone test)
		const result = await runMigrations({
			migrations,
			dialect,
			tracker,
			buildContext,
			log,
		});

		console.warn(`\nApplied: ${result.successCount} migration(s) in batch ${result.batch}`);
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
}

main().catch((err: unknown) => {
	console.error('Migration run failed:', err);
	process.exit(1);
});

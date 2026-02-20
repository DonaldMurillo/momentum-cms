/**
 * Migration Generate CLI
 *
 * Diffs the desired schema (from collections) against the last snapshot,
 * and writes a timestamped migration file + updated snapshot.
 *
 * Usage: npx tsx generate.ts <configPath> [--name <name>] [--dry-run]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveMigrationConfig } from '@momentumcms/core';
import { collectionsToSchema } from '../lib/schema/collections-to-schema';
import { diffSchemas } from '../lib/schema/schema-diff';
import { detectDangers } from '../lib/danger/danger-detector';
import {
	generateMigrationFileContent,
	generateMigrationName,
} from '../lib/generator/migration-file-generator';
import { createSchemaSnapshot } from '../lib/schema/schema-snapshot';
import { readSnapshot, writeSnapshot } from '../lib/loader/snapshot-manager';
import {
	loadMomentumConfig,
	resolveDialect,
	buildIntrospector,
	parseMigrationArgs,
} from './shared';

async function main(): Promise<void> {
	const args = parseMigrationArgs(process.argv.slice(2));
	const config = await loadMomentumConfig(resolve(args.configPath));
	const adapter = config.db.adapter;
	const dialect = resolveDialect(adapter);
	const migrationConfig = resolveMigrationConfig(config.migrations ?? {});

	if (!migrationConfig) {
		console.warn('No migration config found. Add migrations to your momentum.config.ts.');
		process.exit(1);
	}

	const directory = resolve(migrationConfig.directory);

	// 1. Build desired schema from collections
	const desired = collectionsToSchema(config.collections, dialect);

	// 2. Get previous schema (snapshot or introspect or empty)
	let previous = readSnapshot(directory);
	if (!previous) {
		// First run: try introspecting the live DB
		try {
			const introspect = buildIntrospector(adapter, dialect);
			previous = await introspect();
		} catch {
			// No DB available — use empty schema
			previous = createSchemaSnapshot(dialect, []);
		}
	}

	// 3. Diff
	const diff = diffSchemas(desired, previous, dialect);

	if (diff.operations.length === 0) {
		console.warn('Schema up to date. No migration needed.');
		// Still write snapshot to ensure it exists
		if (!args.dryRun) {
			writeSnapshot(directory, desired);
		}
		return;
	}

	// 4. Danger detection
	if (migrationConfig.dangerDetection) {
		const dangers = detectDangers(diff.operations, dialect);
		if (dangers.warnings.length > 0) {
			console.warn('\n--- Danger Detection ---');
			for (const w of dangers.warnings) {
				console.warn(`  [${w.severity}] ${w.message}`);
				if (w.suggestion) console.warn(`    Suggestion: ${w.suggestion}`);
			}
			if (dangers.hasErrors) {
				console.error('\nBlocked: migration contains error-severity dangers.');
				console.error(
					'Review the operations and adjust your collections, or disable danger detection.',
				);
				process.exit(1);
			}
			console.warn('');
		}
	}

	// 5. Generate migration file
	const migrationName = args.name ?? 'migration';
	const timestampedName = generateMigrationName(migrationName);
	const fileContent = generateMigrationFileContent(diff, {
		name: timestampedName,
		dialect,
	});

	if (args.dryRun) {
		console.warn('\n--- Dry Run (migration file content) ---\n');
		console.warn(fileContent);
		console.warn(`\nWould write: ${join(directory, `${timestampedName}.ts`)}`);
		console.warn(`Operations: ${diff.operations.length}`);
		console.warn(`Summary: ${diff.summary.join('; ')}`);
		return;
	}

	// 6. Write migration file
	mkdirSync(directory, { recursive: true });
	const filePath = join(directory, `${timestampedName}.ts`);
	writeFileSync(filePath, fileContent, 'utf-8');

	// 7. Write updated snapshot
	writeSnapshot(directory, desired);

	// 8. Print summary
	console.warn(`\nGenerated migration: ${filePath}`);
	console.warn(`Operations: ${diff.operations.length}`);
	console.warn(`Summary: ${diff.summary.join('; ')}`);
}

main().catch((err: unknown) => {
	console.error('Migration generate failed:', err);
	process.exit(1);
});

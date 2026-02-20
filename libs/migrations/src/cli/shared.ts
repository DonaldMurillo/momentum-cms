/**
 * Shared CLI Utilities
 *
 * Config loading, adapter bridging, and argument parsing
 * for the migration CLI commands (generate, run, status, rollback).
 */
import { pathToFileURL } from 'node:url';
import type { ResolvedMomentumConfig, DatabaseAdapter } from '@momentumcms/core';
import type { DatabaseDialect } from '../lib/schema/column-type-map';
import type { TrackerQueryFn } from '../lib/tracking/migration-tracker';
import type { MigrationContext } from '../lib/migration.types';
import type { PushRunnerDb } from '../lib/runner/push-runner';
import type { CloneCapableDb } from '../lib/runner/clone-test-apply';
import type { DatabaseSchemaSnapshot } from '../lib/schema/schema-snapshot';
import { introspectPostgres } from '../lib/schema/introspect-postgres';
import { introspectSqlite } from '../lib/schema/introspect-sqlite';
import { createDataHelpers } from '../lib/helpers/data-helpers';

/**
 * Type guard for ResolvedMomentumConfig.
 */
function isResolvedConfig(value: unknown): value is ResolvedMomentumConfig {
	return typeof value === 'object' && value !== null && 'collections' in value && 'db' in value;
}

/**
 * Load a MomentumConfig from a file path using dynamic import.
 */
export async function loadMomentumConfig(configPath: string): Promise<ResolvedMomentumConfig> {
	const configUrl = pathToFileURL(configPath).href;
	const mod: Record<string, unknown> = await import(configUrl);
	const raw: unknown = mod['default'] ?? mod;

	if (!isResolvedConfig(raw)) {
		throw new Error(`Config at ${configPath} is not a valid ResolvedMomentumConfig`);
	}

	if (!raw.db?.adapter) {
		throw new Error(`Config at ${configPath} is missing db.adapter`);
	}

	if (!raw.collections || raw.collections.length === 0) {
		throw new Error(`Config at ${configPath} has no collections`);
	}

	return raw;
}

/**
 * Resolve the database dialect from an adapter.
 * Throws if the adapter doesn't declare its dialect.
 */
export function resolveDialect(adapter: DatabaseAdapter): DatabaseDialect {
	if (!adapter.dialect) {
		throw new Error(
			'DatabaseAdapter.dialect is not set. ' +
				'Ensure your adapter factory (postgresAdapter/sqliteAdapter) sets the dialect property.',
		);
	}
	return adapter.dialect;
}

/**
 * Bridge a DatabaseAdapter to TrackerQueryFn.
 */
export function buildTrackerFromAdapter(adapter: DatabaseAdapter): TrackerQueryFn {
	if (!adapter.queryRaw || !adapter.executeRaw) {
		throw new Error('DatabaseAdapter must implement queryRaw and executeRaw for migration tracking');
	}

	const queryRaw = adapter.queryRaw.bind(adapter);
	const executeRaw = adapter.executeRaw.bind(adapter);

	return {
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			return queryRaw<T>(sql, params);
		},
		async execute(sql: string, params?: unknown[]): Promise<number> {
			return executeRaw(sql, params);
		},
	};
}

/**
 * Bridge a DatabaseAdapter to MigrationContext.
 */
export function buildContextFromAdapter(
	adapter: DatabaseAdapter,
	dialect: DatabaseDialect,
): MigrationContext {
	if (!adapter.queryRaw || !adapter.executeRaw) {
		throw new Error('DatabaseAdapter must implement queryRaw and executeRaw for migration context');
	}

	const queryRaw = adapter.queryRaw.bind(adapter);
	const executeRaw = adapter.executeRaw.bind(adapter);

	const dataDb = {
		async execute(sql: string, params?: unknown[]): Promise<number> {
			return executeRaw(sql, params);
		},
		async query<T extends Record<string, unknown>>(
			sql: string,
			params?: unknown[],
		): Promise<T[]> {
			return queryRaw<T>(sql, params);
		},
	};

	const helpers = createDataHelpers(dataDb, dialect);

	return {
		async sql(query: string, params?: unknown[]): Promise<void> {
			await executeRaw(query, params);
		},
		async query<T extends Record<string, unknown>>(
			sql: string,
			params?: unknown[],
		): Promise<T[]> {
			return queryRaw<T>(sql, params);
		},
		data: helpers,
		dialect,
		log: {
			info: (msg: string): void => {
				console.warn(`[migration] ${msg}`);
			},
			warn: (msg: string): void => {
				console.warn(`[migration:warn] ${msg}`);
			},
		},
	};
}

/**
 * Bridge a DatabaseAdapter to PushRunnerDb.
 */
export function buildPushDbFromAdapter(adapter: DatabaseAdapter): PushRunnerDb {
	if (!adapter.executeRaw) {
		throw new Error('DatabaseAdapter must implement executeRaw for push mode');
	}

	const executeRaw = adapter.executeRaw.bind(adapter);

	return {
		async executeRaw(sql: string): Promise<number> {
			return executeRaw(sql);
		},
	};
}

/**
 * Bridge a DatabaseAdapter to CloneCapableDb.
 */
export function buildCloneDbFromAdapter(adapter: DatabaseAdapter): CloneCapableDb {
	if (!adapter.cloneDatabase || !adapter.dropClone) {
		throw new Error('DatabaseAdapter must implement cloneDatabase and dropClone for clone-test-apply');
	}

	return {
		cloneDatabase: adapter.cloneDatabase.bind(adapter),
		dropClone: adapter.dropClone.bind(adapter),
	};
}

/**
 * Build an introspection function from a DatabaseAdapter.
 */
export function buildIntrospector(
	adapter: DatabaseAdapter,
	dialect: DatabaseDialect,
): () => Promise<DatabaseSchemaSnapshot> {
	if (!adapter.queryRaw) {
		throw new Error('DatabaseAdapter must implement queryRaw for introspection');
	}

	const queryRaw = adapter.queryRaw.bind(adapter);

	if (dialect === 'postgresql') {
		const queryFn = async <T extends Record<string, unknown>>(
			sql: string,
			params?: unknown[],
		): Promise<T[]> => queryRaw<T>(sql, params);

		return (): Promise<DatabaseSchemaSnapshot> => introspectPostgres(queryFn);
	}

	const queryFn = async <T extends Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<T[]> => queryRaw<T>(sql, params);

	return (): Promise<DatabaseSchemaSnapshot> => introspectSqlite(queryFn);
}

/**
 * Parsed CLI arguments for migration commands.
 */
export interface MigrationCliArgs {
	/** Path to momentum.config.ts */
	configPath: string;
	/** Migration name (for generate) */
	name?: string;
	/** Dry run — show changes without writing files */
	dryRun?: boolean;
	/** Test only — run clone test but don't apply to real DB */
	testOnly?: boolean;
	/** Skip clone test safety pipeline */
	skipCloneTest?: boolean;
}

/**
 * Parse CLI arguments for migration commands.
 *
 * Usage: npx tsx <command>.ts <configPath> [--name <name>] [--dry-run] [--test-only] [--skip-clone-test]
 */
export function parseMigrationArgs(args: string[]): MigrationCliArgs {
	const configPath = args.find((a) => !a.startsWith('--'));
	if (!configPath) {
		throw new Error('Usage: npx tsx <command>.ts <configPath> [options]');
	}

	let name: string | undefined;
	const nameIdx = args.indexOf('--name');
	if (nameIdx !== -1 && args[nameIdx + 1]) {
		name = args[nameIdx + 1];
	}

	return {
		configPath,
		name,
		dryRun: args.includes('--dry-run'),
		testOnly: args.includes('--test-only'),
		skipCloneTest: args.includes('--skip-clone-test'),
	};
}

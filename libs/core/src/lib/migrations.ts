/**
 * Migration Types for Momentum CMS
 *
 * Universal (browser + server) types for the migration system.
 * Server-only implementation lives in @momentumcms/migrations.
 */

/**
 * Configuration for the migration system.
 * Added to MomentumConfig.migrations when migrations are enabled.
 */
export interface MigrationConfig {
	/**
	 * Directory where migration files are stored.
	 * Relative to the app root.
	 * @default './migrations'
	 */
	directory?: string;

	/**
	 * Database operation mode.
	 * - 'push': Dev mode — direct schema sync, no migration files
	 * - 'migrate': Production mode — migration files required
	 * - 'auto': 'push' in development, 'migrate' in production
	 * @default 'auto'
	 */
	mode?: 'push' | 'migrate' | 'auto';

	/**
	 * Enable clone-test-apply safety pipeline before applying migrations.
	 * When enabled, migrations are first tested on a database clone.
	 * @default true in migrate mode
	 */
	cloneTest?: boolean;

	/**
	 * Enable dangerous operation detection and warnings.
	 * @default true
	 */
	dangerDetection?: boolean;

	/**
	 * Automatically apply pending migrations on server start.
	 * Only applies in 'push' mode. Migrate mode always requires explicit CLI commands.
	 * @default true in push mode
	 */
	autoApply?: boolean;
}

/**
 * Status of an individual applied migration.
 */
export interface MigrationStatus {
	/** Migration filename (without extension) */
	name: string;
	/** Batch number (migrations applied together share a batch) */
	batch: number;
	/** When the migration was applied (ISO string) */
	appliedAt: string;
	/** SHA-256 checksum of the migration file */
	checksum: string;
	/** How long the migration took to execute (ms) */
	executionMs: number;
}

/**
 * Overall migration system status (browser-safe for admin UI).
 */
export interface MigrationSystemStatus {
	/** Whether the database schema matches the collection config */
	inSync: boolean;
	/** Number of pending (unapplied) migrations */
	pending: number;
	/** List of applied migrations */
	applied: MigrationStatus[];
	/** Current migration mode */
	mode: 'push' | 'migrate';
}

/**
 * Severity levels for dangerous operation warnings.
 */
export type DangerSeverity = 'warning' | 'destructive' | 'irreversible';

/**
 * Resolved migration config with defaults applied.
 */
export interface ResolvedMigrationConfig extends MigrationConfig {
	directory: string;
	mode: 'push' | 'migrate';
	cloneTest: boolean;
	dangerDetection: boolean;
	autoApply: boolean;
}

/**
 * Resolve the effective migration mode from config and environment.
 */
export function resolveMigrationMode(mode: MigrationConfig['mode']): 'push' | 'migrate' {
	if (mode === 'push' || mode === 'migrate') return mode;
	// 'auto' or undefined: infer from NODE_ENV
	/* eslint-disable local/no-direct-browser-apis, @typescript-eslint/consistent-type-assertions -- universal code, process may not exist in browser */
	const env = (
		(globalThis as Record<string, unknown>)['process'] as
			| { env: Record<string, string | undefined> }
			| undefined
	)?.env?.['NODE_ENV'];
	/* eslint-enable local/no-direct-browser-apis, @typescript-eslint/consistent-type-assertions */
	if (env === 'production') return 'migrate';
	return 'push';
}

/**
 * Resolve migration config with defaults applied.
 */
export function resolveMigrationConfig(
	config: MigrationConfig | undefined,
): ResolvedMigrationConfig | undefined {
	if (!config) return undefined;
	const mode = resolveMigrationMode(config.mode);
	return {
		...config,
		directory: config.directory ?? './migrations',
		mode,
		cloneTest: config.cloneTest ?? mode === 'migrate',
		dangerDetection: config.dangerDetection ?? true,
		autoApply: config.autoApply ?? mode === 'push',
	};
}

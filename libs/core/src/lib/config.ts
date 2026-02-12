import type { CollectionConfig, GlobalConfig } from './collections';
import type { SeedingConfig, SeedingOptions } from './seeding';
import type {
	DocumentVersion,
	DocumentStatus,
	VersionQueryOptions,
	VersionCountOptions,
	CreateVersionOptions,
} from './versions';
import type { MomentumPlugin } from './plugins';
import type { StorageAdapter } from './storage';

/**
 * Minimum password length for user accounts.
 * Shared across seeding, user sync hooks, and setup middleware.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Database adapter type for Momentum CMS.
 * This is a placeholder type - actual adapters implement this interface.
 */
export interface DatabaseAdapter {
	find(collection: string, query: Record<string, unknown>): Promise<Record<string, unknown>[]>;
	findById(collection: string, id: string): Promise<Record<string, unknown> | null>;
	create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
	update(
		collection: string,
		id: string,
		data: Record<string, unknown>,
	): Promise<Record<string, unknown>>;
	delete(collection: string, id: string): Promise<boolean>;
	/**
	 * Soft delete a document by setting its deletedAt timestamp.
	 * @param collection - The collection slug
	 * @param id - The document ID
	 * @param field - The name of the deletedAt column (default: 'deletedAt')
	 * @returns Whether the update was successful
	 */
	softDelete?(collection: string, id: string, field?: string): Promise<boolean>;

	/**
	 * Restore a soft-deleted document by clearing its deletedAt timestamp.
	 * @param collection - The collection slug
	 * @param id - The document ID
	 * @param field - The name of the deletedAt column (default: 'deletedAt')
	 * @returns The restored document
	 */
	restore?(collection: string, id: string, field?: string): Promise<Record<string, unknown>>;

	/**
	 * Initialize database schema based on collections.
	 * Called once when the server starts.
	 */
	initialize?(collections: CollectionConfig[]): Promise<void>;

	// ============================================
	// Version Operations (optional, for versioned collections)
	// ============================================

	/**
	 * Create a new version for a document.
	 * @param collection - The collection slug
	 * @param parentId - The parent document ID
	 * @param data - The document data to snapshot
	 * @param options - Version creation options
	 */
	createVersion?(
		collection: string,
		parentId: string,
		data: Record<string, unknown>,
		options?: CreateVersionOptions,
	): Promise<DocumentVersion>;

	/**
	 * Find all versions for a document.
	 * @param collection - The collection slug
	 * @param parentId - The parent document ID
	 * @param options - Query options (limit, page, etc.)
	 */
	findVersions?(
		collection: string,
		parentId: string,
		options?: VersionQueryOptions,
	): Promise<DocumentVersion[]>;

	/**
	 * Find a specific version by ID.
	 * @param collection - The collection slug
	 * @param versionId - The version ID
	 */
	findVersionById?(collection: string, versionId: string): Promise<DocumentVersion | null>;

	/**
	 * Restore a document to a previous version.
	 * Creates a new version with the restored data.
	 * @param collection - The collection slug
	 * @param versionId - The version ID to restore
	 */
	restoreVersion?(collection: string, versionId: string): Promise<Record<string, unknown>>;

	/**
	 * Delete old versions for a document.
	 * @param collection - The collection slug
	 * @param parentId - The parent document ID
	 * @param keepLatest - Number of latest versions to keep (default: all)
	 * @returns Number of versions deleted
	 */
	deleteVersions?(collection: string, parentId: string, keepLatest?: number): Promise<number>;

	/**
	 * Count versions for a document.
	 * @param collection - The collection slug
	 * @param parentId - The parent document ID
	 * @param options - Filter options (includeAutosave, status) to match findVersions filters
	 */
	countVersions?(
		collection: string,
		parentId: string,
		options?: VersionCountOptions,
	): Promise<number>;

	/**
	 * Update a document's status (draft/published).
	 * @param collection - The collection slug
	 * @param id - The document ID
	 * @param status - The new status
	 */
	updateStatus?(collection: string, id: string, status: DocumentStatus): Promise<void>;

	/**
	 * Set or clear the scheduled publish date on a document.
	 * @param collection - The collection slug
	 * @param id - The document ID
	 * @param publishAt - ISO date string for scheduled publish, or null to cancel
	 */
	setScheduledPublishAt?(collection: string, id: string, publishAt: string | null): Promise<void>;

	/**
	 * Find all documents scheduled for publishing at or before the given date.
	 * @param collection - The collection slug
	 * @param before - ISO date string; returns docs with scheduledPublishAt <= this value
	 */
	findScheduledDocuments?(
		collection: string,
		before: string,
	): Promise<Array<{ id: string; scheduledPublishAt: string }>>;

	/**
	 * Full-text search across specified fields.
	 * Uses PostgreSQL tsvector/tsquery for efficient text search.
	 *
	 * @param collection - The collection slug
	 * @param query - The search query string
	 * @param fields - Field names to search in
	 * @param options - Pagination options
	 * @returns Array of matching documents sorted by relevance
	 */
	search?(
		collection: string,
		query: string,
		fields: string[],
		options?: { limit?: number; page?: number },
	): Promise<Record<string, unknown>[]>;

	/**
	 * Execute multiple operations within a database transaction.
	 * All operations succeed or all are rolled back.
	 *
	 * @param callback - Async function receiving a transactional adapter.
	 *   All adapter calls inside this callback share the same transaction.
	 * @returns The value returned by the callback
	 */
	transaction?<T>(callback: (txAdapter: DatabaseAdapter) => Promise<T>): Promise<T>;

	// ============================================
	// Globals Operations (optional, for singleton documents)
	// ============================================

	/**
	 * Initialize the globals table.
	 * Called once when the server starts if globals are configured.
	 * @param globals - The global configurations
	 */
	initializeGlobals?(globals: GlobalConfig[]): Promise<void>;

	/**
	 * Find a global document by slug.
	 * @param slug - The global slug
	 * @returns The global data or null if not found
	 */
	findGlobal?(slug: string): Promise<Record<string, unknown> | null>;

	/**
	 * Update (or create) a global document.
	 * Uses upsert semantics: creates if missing, updates if exists.
	 * @param slug - The global slug
	 * @param data - The global data to store
	 * @returns The full global record after update
	 */
	updateGlobal?(slug: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * Database configuration options.
 */
export interface DatabaseConfig {
	/**
	 * Database adapter instance.
	 * Use @momentum-cms/db-drizzle for Drizzle ORM support.
	 */
	adapter: DatabaseAdapter;
}

/**
 * Global admin panel configuration.
 * (Distinct from collection-level AdminConfig)
 */
export interface AdminPanelConfig {
	/**
	 * Base path for admin routes.
	 * @default '/admin'
	 */
	basePath?: string;

	/**
	 * Branding options for admin panel.
	 */
	branding?: {
		logo?: string;
		title?: string;
	};

	/**
	 * Auto-show toast notifications on CUD (Create, Update, Delete) operations.
	 * When enabled, the admin UI shows success/error toasts for all database
	 * modification operations without manual calls in each component.
	 * Only active in the browser, not during SSR.
	 * @default true
	 */
	toasts?: boolean;
}

/**
 * Server configuration.
 */
export interface ServerConfig {
	/**
	 * Port to run the server on.
	 * @default 3000
	 */
	port?: number;

	/**
	 * CORS configuration.
	 */
	cors?: {
		origin?: string | string[];
		methods?: string[];
		headers?: string[];
	};
}

/**
 * Storage configuration for file uploads.
 */
export interface StorageConfig {
	/**
	 * Storage adapter instance.
	 * Use localStorageAdapter or s3StorageAdapter from @momentum-cms/storage.
	 */
	adapter: StorageAdapter;

	/**
	 * Directory for file uploads (for local storage).
	 * @default './uploads'
	 */
	uploadDir?: string;

	/**
	 * Maximum file size in bytes.
	 * @default 10485760 (10MB)
	 */
	maxFileSize?: number;

	/**
	 * Allowed MIME types. Defaults to common image and document types.
	 */
	allowedMimeTypes?: string[];
}

// ============================================
// Logging Configuration (types only — runtime in @momentum-cms/logger)
// ============================================

/**
 * Log level for Momentum CMS logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Log output format.
 */
export type LogFormat = 'pretty' | 'json';

/**
 * Logging configuration for Momentum CMS.
 * Runtime implementation is in @momentum-cms/logger.
 */
export interface LoggingConfig {
	/** Minimum log level. @default 'info' */
	level?: LogLevel;
	/** Output format. @default 'pretty' */
	format?: LogFormat;
	/** Whether to include timestamps. @default true */
	timestamps?: boolean;
}

/**
 * Resolved logging config with defaults applied.
 */
export type ResolvedLoggingConfig = Required<LoggingConfig>;

/**
 * Momentum CMS configuration.
 */
export interface MomentumConfig {
	/**
	 * Database configuration.
	 */
	db: DatabaseConfig;

	/**
	 * Collection definitions.
	 */
	collections: CollectionConfig[];

	/**
	 * Global definitions (singleton documents like site settings).
	 */
	globals?: GlobalConfig[];

	/**
	 * Admin panel configuration.
	 */
	admin?: AdminPanelConfig;

	/**
	 * Server configuration.
	 */
	server?: ServerConfig;

	/**
	 * Storage configuration for file uploads.
	 */
	storage?: StorageConfig;

	/**
	 * Seeding configuration for initial data.
	 * Provides declarative data seeding with strict typing.
	 */
	seeding?: SeedingConfig;

	/**
	 * Logging configuration.
	 * Controls log level, format, and timestamps.
	 */
	logging?: LoggingConfig;

	/**
	 * Plugins to register.
	 * Plugins run in array order during init/ready, reverse during shutdown.
	 */
	plugins?: MomentumPlugin[];
}

/**
 * Resolved seeding options with defaults applied.
 */
export type ResolvedSeedingOptions = Required<SeedingOptions>;

/**
 * Resolved seeding config with defaults applied.
 */
export interface ResolvedSeedingConfig extends SeedingConfig {
	options: ResolvedSeedingOptions;
}

/**
 * Internal config with resolved defaults.
 */
export interface ResolvedMomentumConfig extends MomentumConfig {
	admin: Required<AdminPanelConfig>;
	server: Required<ServerConfig>;
	seeding?: ResolvedSeedingConfig;
	logging: ResolvedLoggingConfig;
}

/**
 * Defines Momentum CMS configuration.
 * This is the main entry point for configuring the CMS.
 *
 * @example
 * ```typescript
 * // momentum.config.ts
 * import { defineMomentumConfig } from '@momentum-cms/core';
 * import { sqliteAdapter } from '@momentum-cms/db-drizzle';
 * import { Posts } from './collections/posts';
 * import { Users } from './collections/users';
 *
 * export default defineMomentumConfig({
 *   db: {
 *     adapter: sqliteAdapter({ filename: './data/momentum.db' }),
 *   },
 *   collections: [Posts, Users],
 *   admin: {
 *     basePath: '/admin',
 *     branding: {
 *       title: 'My CMS',
 *     },
 *   },
 * });
 * ```
 */
export function defineMomentumConfig(config: MomentumConfig): ResolvedMomentumConfig {
	return {
		...config,
		admin: {
			basePath: config.admin?.basePath ?? '/admin',
			branding: config.admin?.branding ?? {},
			toasts: config.admin?.toasts ?? true,
		},
		server: {
			port: config.server?.port ?? 3000,
			cors: config.server?.cors ?? {
				origin: '*',
				methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
				headers: ['Content-Type', 'Authorization'],
			},
		},
		seeding: config.seeding
			? {
					...config.seeding,
					options: {
						onConflict: config.seeding.options?.onConflict ?? 'skip',
						runOnStart: config.seeding.options?.runOnStart ?? 'development',
						quiet: config.seeding.options?.quiet ?? false,
					},
				}
			: undefined,
		logging: {
			level: config.logging?.level ?? 'info',
			format: config.logging?.format ?? 'pretty',
			timestamps: config.logging?.timestamps ?? true,
		},
	};
}

/**
 * Gets the database adapter from the config.
 */
export function getDbAdapter(config: MomentumConfig): DatabaseAdapter {
	return config.db.adapter;
}

/**
 * Gets collections from the config.
 */
export function getCollections(config: MomentumConfig): CollectionConfig[] {
	return config.collections;
}

/**
 * Gets globals from the config.
 */
export function getGlobals(config: MomentumConfig): GlobalConfig[] {
	return config.globals ?? [];
}

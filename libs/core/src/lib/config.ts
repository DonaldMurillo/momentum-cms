import type { CollectionConfig } from './collections';
import type { SeedingConfig, SeedingOptions } from './seeding';
import type {
	DocumentVersion,
	DocumentStatus,
	VersionQueryOptions,
	VersionCountOptions,
	CreateVersionOptions,
} from './versions';

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
	 * Admin panel configuration.
	 */
	admin?: AdminPanelConfig;

	/**
	 * Server configuration.
	 */
	server?: ServerConfig;

	/**
	 * Seeding configuration for initial data.
	 * Provides declarative data seeding with strict typing.
	 */
	seeding?: SeedingConfig;
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

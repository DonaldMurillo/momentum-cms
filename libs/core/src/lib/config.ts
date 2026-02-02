import type { CollectionConfig } from './collections';

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
}

/**
 * Internal config with resolved defaults.
 */
export interface ResolvedMomentumConfig extends MomentumConfig {
	admin: Required<AdminPanelConfig>;
	server: Required<ServerConfig>;
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

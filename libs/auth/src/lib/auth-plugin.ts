/**
 * Momentum Auth Plugin Factory
 *
 * Creates a first-class Momentum plugin that manages all Better Auth integration:
 * - Injects auth collections into the Momentum config (schema generation)
 * - Creates the Better Auth instance with dynamic plugins/fields
 * - Exposes getAuth()/tryGetAuth() for server framework middleware creation
 *
 * Framework-agnostic: no Express dependency. Middleware creation is handled by
 * @momentumcms/server-express (initializeMomentum + createDeferredSessionResolver).
 */

import type { MomentumPlugin, PluginContext, CollectionConfig, Field } from '@momentumcms/core';
import {
	createMomentumAuth,
	type MomentumAuth,
	type DatabaseConfig,
	type MomentumEmailOptions,
	type OAuthProvidersConfig,
} from './auth';
import {
	BASE_AUTH_COLLECTIONS,
	AuthUserCollection,
	AuthSessionCollection,
} from './auth-collections';
import type { MomentumAuthSubPlugin } from './plugins/sub-plugin.types';

/**
 * Configuration for the Momentum Auth plugin.
 */
export interface MomentumAuthPluginConfig {
	/** Database configuration (same as createMomentumAuth) */
	db: DatabaseConfig;
	/** Base URL of the application (e.g., 'http://localhost:4000') */
	baseURL?: string;
	/** Secret key for signing tokens */
	secret?: string;
	/** Trusted origins for CORS */
	trustedOrigins?: string[];
	/** Email configuration */
	email?: MomentumEmailOptions;
	/** OAuth social login providers */
	socialProviders?: OAuthProvidersConfig;
	/** Auth sub-plugins (2FA, admin, organization, etc.) */
	plugins?: MomentumAuthSubPlugin[];
	/** Admin UI configuration */
	admin?: {
		/** Show auth collections in admin UI. Default: true */
		showCollections?: boolean;
	};
	/** Extra fields to add to the auth-user collection */
	userFields?: Field[];
}

/**
 * Config exposed by the auth plugin for the server framework to create middleware.
 * This avoids the auth library needing to import server-express (circular dep).
 */
export interface MomentumAuthPluginRuntimeConfig {
	db: DatabaseConfig;
	socialProviders?: OAuthProvidersConfig;
}

export interface MomentumAuthPlugin extends MomentumPlugin {
	/** Get the Better Auth instance (available after onInit). Throws if not yet initialized. */
	getAuth(): MomentumAuth;
	/** Get the Better Auth instance if initialized, or null if not yet ready. */
	tryGetAuth(): MomentumAuth | null;
	/** Get the plugin's runtime config (db, socialProviders) for server-framework middleware creation. */
	getPluginConfig(): MomentumAuthPluginRuntimeConfig;
}

/**
 * Creates the Momentum Auth plugin.
 *
 * This is the recommended way to integrate Better Auth with Momentum CMS.
 * Add the returned plugin to your `momentum.config.ts` plugins array.
 *
 * @example
 * ```typescript
 * import { momentumAuth, authTwoFactor } from '@momentumcms/auth';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     momentumAuth({
 *       db: { type: 'postgres', pool },
 *       baseURL: 'http://localhost:4000',
 *       plugins: [authTwoFactor()],
 *     }),
 *   ],
 *   collections: [Posts],
 * });
 * ```
 */
export function momentumAuth(config: MomentumAuthPluginConfig): MomentumAuthPlugin {
	let authInstance: MomentumAuth | null = null;

	// Collect all sub-plugin data
	const subPlugins = config.plugins ?? [];
	const allCollections: CollectionConfig[] = [];
	const allUserFields: Field[] = [...(config.userFields ?? [])];
	const allSessionFields: Field[] = [];
	const allBetterAuthPlugins: unknown[] = [];

	// Gather sub-plugin contributions
	for (const sp of subPlugins) {
		if (sp.collections) allCollections.push(...sp.collections);
		if (sp.userFields) allUserFields.push(...sp.userFields);
		if (sp.sessionFields) allSessionFields.push(...sp.sessionFields);
		if (sp.betterAuthPlugin !== undefined) allBetterAuthPlugins.push(sp.betterAuthPlugin);
	}

	// Clone base auth collections so we can add fields without mutating the originals
	const authUserWithFields: CollectionConfig = {
		...AuthUserCollection,
		fields: [...AuthUserCollection.fields, ...allUserFields],
	};

	const authSessionWithFields: CollectionConfig = {
		...AuthSessionCollection,
		fields: [...AuthSessionCollection.fields, ...allSessionFields],
	};

	// Build the final list of auth collections (replace base user/session with enriched versions)
	const finalAuthCollections: CollectionConfig[] = [
		authUserWithFields,
		authSessionWithFields,
		// All base collections except user and session (which we replaced above)
		...BASE_AUTH_COLLECTIONS.filter((c) => c.slug !== 'auth-user' && c.slug !== 'auth-session'),
		// Sub-plugin collections
		...allCollections,
	];

	// Apply admin visibility settings
	const showInAdmin = config.admin?.showCollections ?? true;
	if (!showInAdmin) {
		for (const c of finalAuthCollections) {
			c.admin = { ...c.admin, hidden: true };
		}
	}

	return {
		name: 'momentum-auth',

		// Static collections for admin UI route data (read at config time)
		collections: finalAuthCollections,

		// Browser-safe import paths for the admin config generator
		browserImports: {
			collections: {
				path: '@momentumcms/auth/collections',
				exportName: 'BASE_AUTH_COLLECTIONS',
			},
		},

		getAuth(): MomentumAuth {
			if (!authInstance) {
				throw new Error('Auth not initialized. Call onInit first (via initializeMomentum).');
			}
			return authInstance;
		},

		tryGetAuth(): MomentumAuth | null {
			return authInstance;
		},

		getPluginConfig(): MomentumAuthPluginRuntimeConfig {
			return {
				db: config.db,
				socialProviders: config.socialProviders,
			};
		},

		async onInit(context: PluginContext): Promise<void> {
			const { logger } = context;

			// 1. Inject auth collections into the config
			context.collections.push(...finalAuthCollections);
			logger.info(`Injected ${finalAuthCollections.length} auth collections`);

			// 2. Create the Better Auth instance
			authInstance = createMomentumAuth({
				db: config.db,
				baseURL: config.baseURL,
				secret: config.secret,
				trustedOrigins: config.trustedOrigins,
				email: config.email,
				socialProviders: config.socialProviders,
				plugins: allBetterAuthPlugins,
				userFields: allUserFields,
			});
			logger.info('Better Auth instance created');

			// Note: Auth and setup middleware are auto-registered by initializeMomentum()
			// in @momentumcms/server-express after detecting this plugin via getAuth().
			// This keeps the auth library framework-agnostic (no Express dependency).
		},
	};
}

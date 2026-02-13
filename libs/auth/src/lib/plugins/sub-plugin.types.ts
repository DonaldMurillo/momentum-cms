/**
 * Sub-Plugin Types for Momentum Auth
 *
 * Each sub-plugin wraps a Better Auth plugin and brings its own
 * collections, user/session fields, and admin routes.
 */

import type { CollectionConfig, Field } from '@momentum-cms/core';
import type { PluginAdminRouteDescriptor } from '@momentum-cms/core';

/**
 * A Momentum Auth sub-plugin wraps a Better Auth plugin.
 *
 * It declares what schema changes and admin UI additions the
 * Better Auth plugin requires, allowing the auth plugin factory
 * to merge everything together.
 */
export interface MomentumAuthSubPlugin {
	/** Human-readable name (for logging / admin UI). */
	name: string;

	/** The Better Auth plugin instance to be spread into betterAuth({ plugins: [...] }). */
	betterAuthPlugin: unknown;

	/** Additional managed collections this plugin needs. */
	collections?: CollectionConfig[];

	/** Extra fields to add to the auth-user collection. */
	userFields?: Field[];

	/** Extra fields to add to the auth-session collection. */
	sessionFields?: Field[];

	/** Admin routes contributed by this plugin. */
	adminRoutes?: PluginAdminRouteDescriptor[];
}

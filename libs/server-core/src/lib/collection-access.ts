import type { MomentumConfig, CollectionConfig, UserContext, AccessArgs } from '@momentum-cms/core';

/**
 * Result of checking admin access for a single collection.
 */
export interface CollectionAccess {
	slug: string;
	canAccess: boolean;
}

/**
 * Full access permissions for a collection.
 */
export interface CollectionPermissions {
	slug: string;
	canAccess: boolean;
	canCreate: boolean;
	canRead: boolean;
	canUpdate: boolean;
	canDelete: boolean;
	/** True if this collection is managed (read-only via API, owned by a plugin like Better Auth). */
	managed?: boolean;
}

/**
 * Response shape for the /access endpoint.
 */
export interface AccessResponse {
	collections: CollectionPermissions[];
}

/**
 * Checks if a user has admin panel access to a specific collection.
 *
 * @param collection - The collection config to check
 * @param user - The current user context (undefined if not authenticated)
 * @returns true if access is allowed, false otherwise
 */
export async function checkSingleCollectionAdminAccess(
	collection: CollectionConfig,
	user: UserContext | undefined,
): Promise<boolean> {
	const adminFn = collection.access?.admin;

	// No admin access function defined = allow authenticated users
	if (!adminFn) {
		return !!user;
	}

	const accessArgs: AccessArgs = {
		req: { user },
	};

	return Promise.resolve(adminFn(accessArgs));
}

/**
 * Checks a specific access function for a collection.
 */
async function checkAccessFunction(
	accessFn: ((args: AccessArgs) => boolean | Promise<boolean>) | undefined,
	user: UserContext | undefined,
	defaultIfUndefined: boolean,
): Promise<boolean> {
	if (!accessFn) {
		return defaultIfUndefined;
	}

	const accessArgs: AccessArgs = {
		req: { user },
	};

	return Promise.resolve(accessFn(accessArgs));
}

/**
 * Checks admin access for all collections in a configuration.
 * Returns which collections the user can access in the admin panel.
 *
 * @param config - The Momentum CMS configuration
 * @param user - The current user context (undefined if not authenticated)
 * @returns Array of collection slugs with their access status
 */
export async function checkCollectionAdminAccess(
	config: MomentumConfig,
	user: UserContext | undefined,
): Promise<CollectionAccess[]> {
	const results = await Promise.all(
		config.collections.map(async (collection) => ({
			slug: collection.slug,
			canAccess: await checkSingleCollectionAdminAccess(collection, user),
		})),
	);

	return results;
}

/**
 * Gets full permissions for all collections.
 * Used by the /access endpoint to inform the frontend about what
 * operations the user can perform.
 *
 * @param config - The Momentum CMS configuration
 * @param user - The current user context (undefined if not authenticated)
 * @returns Full permissions for each collection
 */
export async function getCollectionPermissions(
	config: MomentumConfig,
	user: UserContext | undefined,
): Promise<CollectionPermissions[]> {
	const results = await Promise.all(
		config.collections.map(async (collection) => {
			const isManaged = collection.managed === true;

			// Check all access functions in parallel
			const [canAccess, canCreate, canRead, canUpdate, canDelete] = await Promise.all([
				checkSingleCollectionAdminAccess(collection, user),
				isManaged
					? Promise.resolve(false)
					: checkAccessFunction(collection.access?.create, user, !!user),
				checkAccessFunction(collection.access?.read, user, true),
				isManaged
					? Promise.resolve(false)
					: checkAccessFunction(collection.access?.update, user, !!user),
				isManaged
					? Promise.resolve(false)
					: checkAccessFunction(collection.access?.delete, user, !!user),
			]);

			return {
				slug: collection.slug,
				canAccess,
				canCreate,
				canRead,
				canUpdate,
				canDelete,
				...(isManaged ? { managed: true } : {}),
			};
		}),
	);

	return results;
}

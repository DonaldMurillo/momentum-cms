/**
 * User Sync Hooks for Momentum CMS
 *
 * Provides hooks to synchronize Momentum CMS users with Better Auth users.
 * When creating a user via the Momentum API with a password, these hooks
 * ensure the corresponding Better Auth user is created first.
 *
 * @example
 * ```typescript
 * import { createUserSyncHook } from '@momentum-cms/server-core';
 * import { createMomentumAuth } from '@momentum-cms/auth';
 *
 * const auth = createMomentumAuth({ ... });
 *
 * // Add hook to users collection at server startup
 * const usersCollection = config.collections.find(c => c.slug === 'users');
 * if (usersCollection) {
 *   usersCollection.hooks = usersCollection.hooks ?? {};
 *   usersCollection.hooks.beforeChange = [
 *     createUserSyncHook({ auth }),
 *     ...(usersCollection.hooks.beforeChange ?? []),
 *   ];
 * }
 * ```
 */

import { MIN_PASSWORD_LENGTH, type HookArgs, type HookFunction } from '@momentum-cms/core';
import { createLogger } from '@momentum-cms/logger';

const userSyncLogger = createLogger('UserSync');

/**
 * Better Auth API interface for user creation.
 * This matches the api property from createMomentumAuth().
 */
export interface BetterAuthAPI {
	signUpEmail: (options: {
		body: { name: string; email: string; password: string };
	}) => Promise<{ user?: { id: string } | null } | null>;
}

/**
 * Momentum Auth instance type.
 * We use a minimal interface to avoid circular dependencies.
 */
export interface MomentumAuthLike {
	api: BetterAuthAPI;
}

/**
 * Configuration for user sync hooks.
 */
export interface UserSyncConfig {
	/** The Momentum Auth instance (from createMomentumAuth) */
	auth: MomentumAuthLike;
	/** Field name for password in creation data (default: 'password') */
	passwordField?: string;
	/** Field name for authId link to Better Auth (default: 'authId') */
	authIdField?: string;
	/** Default role for new users (default: 'user') */
	defaultRole?: string;
}

/**
 * Creates a beforeChange hook that syncs user creation to Better Auth.
 *
 * When a new user is created via Momentum API with a password field,
 * this hook creates the corresponding Better Auth user first, then
 * sets the authId on the Momentum user record.
 *
 * **Important:**
 * - Only triggers on 'create' operations with a password provided
 * - If no password is provided, allows creation without Better Auth sync
 *   (useful for linking to existing Better Auth users)
 * - Removes the password field from data before Momentum insert
 * - Throws error if Better Auth creation fails (prevents orphaned records)
 *
 * @param config - Configuration options
 * @returns Hook function to use in collection's beforeChange array
 *
 * @example
 * ```typescript
 * // In server.ts, after creating auth instance:
 * const userSyncHook = createUserSyncHook({ auth });
 *
 * // Add to users collection hooks
 * usersCollection.hooks = {
 *   beforeChange: [userSyncHook],
 * };
 * ```
 */
export function createUserSyncHook(config: UserSyncConfig): HookFunction {
	const { auth, passwordField = 'password', authIdField = 'authId' } = config;

	return async (args: HookArgs): Promise<Record<string, unknown>> => {
		const { data, operation } = args;

		if (!data) {
			return data ?? {};
		}

		// Only sync on create operations
		if (operation !== 'create') {
			return data;
		}

		// Check if password is provided (indicating new Better Auth user should be created)
		const password = data[passwordField];
		if (!password || typeof password !== 'string') {
			// No password - allow creating Momentum user without Better Auth sync
			// This is useful for linking to existing Better Auth users via authId
			return data;
		}

		// Validate required fields
		const email = data['email'];
		const name = data['name'];

		if (!email || typeof email !== 'string') {
			throw new Error('Email is required to create a user with password');
		}
		if (!name || typeof name !== 'string') {
			throw new Error('Name is required to create a user with password');
		}

		// Validate password length (Better Auth requires min 8 chars)
		if (password.length < MIN_PASSWORD_LENGTH) {
			throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
		}

		try {
			// Create user in Better Auth first
			const result = await auth.api.signUpEmail({
				body: { name, email, password },
			});

			if (!result || !result.user) {
				throw new Error('Failed to create Better Auth user');
			}

			// Note: Better Auth's signUpEmail doesn't allow setting role directly.
			// The role is managed separately via direct DB update (see setup-middleware).
			// For now, role is only set in Momentum collection.
			const role = data['role'];
			if (role && role !== 'user') {
				userSyncLogger.warn(
					`Role '${role}' set in Momentum only. Better Auth user has default role.`,
				);
			}

			// Return data with authId linked and password removed
			const { [passwordField]: _password, ...restData } = data;
			return {
				...restData,
				[authIdField]: result.user.id,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			// Check for duplicate email error from Better Auth
			if (message.toLowerCase().includes('email') && message.toLowerCase().includes('exist')) {
				throw new Error(`User with email '${email}' already exists`);
			}

			throw new Error(`Failed to sync user to Better Auth: ${message}`);
		}
	};
}

/**
 * Creates a beforeDelete hook that logs a warning when deleting Momentum users.
 *
 * **Note:** Better Auth doesn't expose a standard user deletion API.
 * This hook logs a warning - implement custom DB deletion if needed.
 *
 * @param _config - Configuration options (currently unused)
 * @returns Hook function to use in collection's beforeDelete array
 */
export function createUserDeleteSyncHook(_config: UserSyncConfig): HookFunction {
	return async (args: HookArgs): Promise<void> => {
		const { doc } = args;

		if (!doc) return;

		const authId = doc['authId'];
		if (authId) {
			userSyncLogger.warn(
				`Momentum user deleted but Better Auth user ${authId} remains. Manual cleanup may be required.`,
			);
		}
	};
}

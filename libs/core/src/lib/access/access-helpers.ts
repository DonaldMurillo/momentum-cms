/**
 * Access Control Helpers
 *
 * Provides type-safe helper functions for defining access control rules.
 * These helpers improve DX by providing:
 * - Full IntelliSense for user properties
 * - Type-safe role checking
 * - Common access patterns as simple functions
 *
 * @example
 * ```typescript
 * import { access, hasRole, hasAnyRole, isAuthenticated, allowAll } from '@momentum-cms/core';
 *
 * // Using pre-built helpers
 * access: {
 *   read: allowAll(),
 *   create: isAuthenticated(),
 *   update: hasAnyRole(['admin', 'editor']),
 *   delete: hasRole('admin'),
 * }
 *
 * // Using typed custom access
 * interface MyUser {
 *   id: string;
 *   role: 'admin' | 'editor' | 'viewer';
 *   permissions: string[];
 * }
 *
 * access: {
 *   read: access<MyUser>(({ user }) => user?.permissions.includes('read') ?? false),
 *   create: access<MyUser>(({ user }) => user?.role !== 'viewer'),
 * }
 * ```
 */

import type { AccessFunction, UserContext } from '../collections/collection.types';

// ============================================
// Types
// ============================================

/**
 * Arguments passed to access callback functions.
 * Generic over user type for full type safety.
 */
export interface AccessCallbackArgs<TUser extends UserContext = UserContext> {
	/** The authenticated user, or undefined if not authenticated */
	user: TUser | undefined;
	/** Document ID (for update/delete operations) */
	id?: string | number;
	/** Document data (for create/update operations) */
	data?: Record<string, unknown>;
}

/**
 * Typed access callback function.
 * Receives user-friendly arguments with full type inference.
 */
export type AccessCallback<TUser extends UserContext = UserContext> = (
	args: AccessCallbackArgs<TUser>,
) => boolean | Promise<boolean>;

// ============================================
// Main Helper
// ============================================

/**
 * Creates a typed access function with full IntelliSense support.
 *
 * Use this when you need custom access logic with type-safe user properties.
 * The generic type parameter lets you define your user shape for autocomplete.
 *
 * @example
 * ```typescript
 * // With default UserContext type
 * access: {
 *   read: access(({ user }) => user?.role === 'admin'),
 * }
 *
 * // With custom user type for full IntelliSense
 * interface MyUser {
 *   id: string;
 *   email: string;
 *   role: 'admin' | 'editor' | 'viewer';
 *   teamId: string;
 * }
 *
 * access: {
 *   read: access<MyUser>(({ user }) => user?.teamId === 'team-1'),
 *   create: access<MyUser>(({ user, data }) => {
 *     // user has full MyUser type with autocomplete
 *     return user?.role === 'admin' || user?.role === 'editor';
 *   }),
 * }
 * ```
 */
export function access<TUser extends UserContext = UserContext>(
	callback: AccessCallback<TUser>,
): AccessFunction {
	return ({ req, id, data }): boolean | Promise<boolean> => {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Cast to generic user type
		const user = req.user as TUser | undefined;
		return callback({ user, id, data });
	};
}

// ============================================
// Pre-built Access Helpers
// ============================================

/**
 * Allow all access (public).
 *
 * @example
 * ```typescript
 * access: {
 *   read: allowAll(), // Anyone can read
 * }
 * ```
 */
export function allowAll(): AccessFunction {
	return (): boolean => true;
}

/**
 * Deny all access.
 *
 * @example
 * ```typescript
 * access: {
 *   delete: denyAll(), // No one can delete
 * }
 * ```
 */
export function denyAll(): AccessFunction {
	return (): boolean => false;
}

/**
 * Require authentication (any logged-in user).
 *
 * @example
 * ```typescript
 * access: {
 *   create: isAuthenticated(), // Any logged-in user can create
 * }
 * ```
 */
export function isAuthenticated(): AccessFunction {
	return ({ req }): boolean => !!req.user;
}

/**
 * Require a specific role.
 *
 * @param role - The role required for access
 *
 * @example
 * ```typescript
 * access: {
 *   delete: hasRole('admin'), // Only admins can delete
 * }
 * ```
 */
export function hasRole(role: string): AccessFunction {
	return ({ req }): boolean => req.user?.role === role;
}

/**
 * Require any of the specified roles.
 *
 * @param roles - Array of roles, any of which grants access
 *
 * @example
 * ```typescript
 * access: {
 *   update: hasAnyRole(['admin', 'editor']), // Admins or editors can update
 * }
 * ```
 */
export function hasAnyRole(roles: readonly string[]): AccessFunction {
	return ({ req }): boolean => {
		const userRole = req.user?.role;
		return userRole !== undefined && roles.includes(userRole);
	};
}

/**
 * Require all of the specified roles (for multi-role systems).
 *
 * @param roles - Array of roles, all of which are required
 *
 * @example
 * ```typescript
 * // If user has multiple roles stored as an array
 * access: {
 *   admin: hasAllRoles(['verified', 'admin']),
 * }
 * ```
 */
export function hasAllRoles(roles: readonly string[]): AccessFunction {
	return ({ req }): boolean => {
		const userRoles = req.user?.['roles'];
		if (!Array.isArray(userRoles)) return false;
		return roles.every((role) => userRoles.includes(role));
	};
}

// ============================================
// Combinators
// ============================================

/**
 * Combine multiple access functions with AND logic.
 * All conditions must pass for access to be granted.
 *
 * @param fns - Access functions to combine
 *
 * @example
 * ```typescript
 * access: {
 *   update: and(isAuthenticated(), hasAnyRole(['admin', 'editor'])),
 * }
 * ```
 */
export function and(...fns: AccessFunction[]): AccessFunction {
	return async (args): Promise<boolean> => {
		for (const fn of fns) {
			const result = await fn(args);
			if (!result) return false;
		}
		return true;
	};
}

/**
 * Combine multiple access functions with OR logic.
 * Any condition passing grants access.
 *
 * @param fns - Access functions to combine
 *
 * @example
 * ```typescript
 * access: {
 *   read: or(allowAll(), hasRole('admin')), // Public read, but admin always allowed
 * }
 * ```
 */
export function or(...fns: AccessFunction[]): AccessFunction {
	return async (args): Promise<boolean> => {
		for (const fn of fns) {
			const result = await fn(args);
			if (result) return true;
		}
		return false;
	};
}

/**
 * Negate an access function.
 *
 * @param fn - Access function to negate
 *
 * @example
 * ```typescript
 * access: {
 *   read: not(hasRole('banned')), // Anyone except banned users
 * }
 * ```
 */
export function not(fn: AccessFunction): AccessFunction {
	return async (args): Promise<boolean> => {
		const result = await fn(args);
		return !result;
	};
}

// ============================================
// Document-based Access
// ============================================

/**
 * Check if the authenticated user owns the document.
 * Compares user.id with the document's author/owner field.
 *
 * @param ownerField - The field name containing the owner's user ID (default: 'createdBy')
 *
 * @example
 * ```typescript
 * access: {
 *   update: or(hasRole('admin'), isOwner()), // Admin or document owner
 *   delete: or(hasRole('admin'), isOwner('authorId')),
 * }
 * ```
 */
export function isOwner(ownerField = 'createdBy'): AccessFunction {
	return ({ req, data }): boolean => {
		if (!req.user?.id) return false;
		const ownerId = data?.[ownerField];
		return ownerId === req.user.id || String(ownerId) === String(req.user.id);
	};
}

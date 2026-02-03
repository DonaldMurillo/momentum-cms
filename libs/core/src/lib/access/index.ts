/**
 * Access Control Module
 *
 * Provides type-safe helper functions for defining access control rules.
 */

export {
	// Main helper
	access,
	// Types
	type AccessCallback,
	type AccessCallbackArgs,
	// Pre-built helpers
	allowAll,
	denyAll,
	isAuthenticated,
	hasRole,
	hasAnyRole,
	hasAllRoles,
	// Combinators
	and,
	or,
	not,
	// Document-based
	isOwner,
} from './access-helpers';

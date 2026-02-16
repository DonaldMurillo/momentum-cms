/**
 * Admin Sub-Plugin (Stub)
 *
 * Wraps Better Auth's admin plugin for user management capabilities:
 * - Ban/unban users
 * - Impersonate users
 * - Admin-level session fields
 *
 * This is a stub — the Better Auth admin plugin import will be added
 * when the full admin integration is implemented.
 */

import { text, checkbox, date } from '@momentumcms/core';
import type { MomentumAuthSubPlugin } from './sub-plugin.types';

/**
 * Creates the admin sub-plugin.
 *
 * Adds ban/impersonation fields to the user and session collections.
 * The actual Better Auth admin plugin will be wired in a future iteration.
 */
export function authAdmin(): MomentumAuthSubPlugin {
	return {
		name: 'admin',
		// Stub: Better Auth admin plugin will be added here
		betterAuthPlugin: undefined,
		userFields: [checkbox('banned'), text('banReason'), date('banExpires')],
		sessionFields: [text('impersonatedBy')],
	};
}

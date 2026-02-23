/**
 * Admin Sub-Plugin
 *
 * Wraps Better Auth's admin plugin for user management capabilities:
 * - Ban/unban users
 * - Impersonate users
 * - Admin-level session fields
 */

import { admin } from 'better-auth/plugins';
import { text, checkbox, date } from '@momentumcms/core';
import type { MomentumAuthSubPlugin } from './sub-plugin.types';

/**
 * Creates the admin sub-plugin.
 *
 * Adds ban/impersonation fields to the user and session collections
 * and registers the Better Auth admin plugin for ban/unban/impersonation endpoints.
 */
export function authAdmin(): MomentumAuthSubPlugin {
	return {
		name: 'admin',
		betterAuthPlugin: admin(),
		userFields: [checkbox('banned'), text('banReason'), date('banExpires')],
		sessionFields: [text('impersonatedBy')],
	};
}

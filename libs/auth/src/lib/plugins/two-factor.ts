/**
 * Two-Factor Authentication Sub-Plugin
 *
 * Wraps Better Auth's twoFactor plugin and provides:
 * - A `twoFactor` managed collection (stores TOTP secrets and backup codes)
 * - A `twoFactorEnabled` field on the auth-user collection
 */

import { twoFactor } from 'better-auth/plugins';
import { defineCollection, text, checkbox } from '@momentumcms/core';
import type { MomentumAuthSubPlugin } from './sub-plugin.types';

const AuthTwoFactorCollection = defineCollection({
	slug: 'auth-two-factor',
	dbName: 'twoFactor',
	managed: true,
	timestamps: false,
	fields: [
		text('secret', { required: true }),
		text('backupCodes', { required: true }),
		text('userId', { required: true }),
	],
	indexes: [{ columns: ['secret'] }, { columns: ['userId'] }],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'Two-factor authentication secrets',
	},
	access: {
		read: () => false,
		create: () => false,
		update: () => false,
		delete: () => false,
	},
});

/**
 * Creates the two-factor authentication sub-plugin.
 */
export function authTwoFactor(): MomentumAuthSubPlugin {
	return {
		name: 'two-factor',
		betterAuthPlugin: twoFactor(),
		collections: [AuthTwoFactorCollection],
		userFields: [checkbox('twoFactorEnabled')],
	};
}

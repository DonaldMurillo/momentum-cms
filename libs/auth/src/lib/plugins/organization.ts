/**
 * Organization Sub-Plugin
 *
 * Wraps Better Auth's organization plugin for multi-tenant capabilities:
 * - Organizations
 * - Members with roles
 * - Invitations
 */

import { organization } from 'better-auth/plugins';
import { defineCollection, text, select, date } from '@momentumcms/core';
import type { MomentumAuthSubPlugin } from './sub-plugin.types';

const AuthOrganizationCollection = defineCollection({
	slug: 'auth-organization',
	dbName: 'organization',
	managed: true,
	timestamps: true,
	fields: [
		text('name', { required: true }),
		text('slug', { required: true }),
		text('logo'),
		text('metadata'),
	],
	indexes: [{ columns: ['slug'], unique: true }],
	admin: {
		group: 'Authentication',
		useAsTitle: 'name',
		description: 'Organizations for multi-tenant access',
	},
	access: {
		read: ({ req }) => req.user?.role === 'admin',
		create: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',
	},
});

const AuthMemberCollection = defineCollection({
	slug: 'auth-member',
	dbName: 'member',
	managed: true,
	timestamps: true,
	fields: [
		text('userId', { required: true }),
		text('organizationId', { required: true }),
		select('role', {
			options: [
				{ label: 'Owner', value: 'owner' },
				{ label: 'Admin', value: 'admin' },
				{ label: 'Member', value: 'member' },
			],
			defaultValue: 'member',
		}),
	],
	indexes: [
		{ columns: ['userId'] },
		{ columns: ['organizationId'] },
		{ columns: ['userId', 'organizationId'], unique: true },
	],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'Organization membership',
	},
	access: {
		read: ({ req }) => req.user?.role === 'admin',
		create: () => false,
		update: () => false,
		delete: () => false,
	},
});

const AuthInvitationCollection = defineCollection({
	slug: 'auth-invitation',
	dbName: 'invitation',
	managed: true,
	timestamps: true,
	fields: [
		text('email', { required: true }),
		text('organizationId', { required: true }),
		text('inviterId', { required: true }),
		select('role', {
			options: [
				{ label: 'Admin', value: 'admin' },
				{ label: 'Member', value: 'member' },
			],
			defaultValue: 'member',
		}),
		select('status', {
			options: [
				{ label: 'Pending', value: 'pending' },
				{ label: 'Accepted', value: 'accepted' },
				{ label: 'Rejected', value: 'rejected' },
				{ label: 'Cancelled', value: 'cancelled' },
			],
			defaultValue: 'pending',
		}),
		date('expiresAt', { required: true }),
	],
	indexes: [{ columns: ['organizationId'] }, { columns: ['email'] }],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'Pending organization invitations',
	},
	access: {
		read: ({ req }) => req.user?.role === 'admin',
		create: () => false,
		update: () => false,
		delete: () => false,
	},
});

/**
 * Creates the organization sub-plugin.
 *
 * Adds organization, member, and invitation collections
 * and registers the Better Auth organization plugin for multi-tenant endpoints.
 */
export function authOrganization(): MomentumAuthSubPlugin {
	return {
		name: 'organization',
		betterAuthPlugin: organization(),
		collections: [AuthOrganizationCollection, AuthMemberCollection, AuthInvitationCollection],
	};
}

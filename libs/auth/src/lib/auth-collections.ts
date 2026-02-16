/**
 * Base Auth Collections for Momentum CMS
 *
 * Defines Better Auth tables as Momentum collections.
 * Visible collections (auth-user, auth-api-keys) are fully interactive in the
 * admin UI with access restricted to admin role. Internal collections (session,
 * account, verification) are managed and hidden — Better Auth owns those data
 * operations.
 *
 * Column types are chosen to match Better Auth's expected schema exactly.
 */

import {
	defineCollection,
	text,
	email as emailField,
	checkbox,
	date,
	select,
	relationship,
} from '@momentumcms/core';
import type { CollectionConfig, SelectOption } from '@momentumcms/core';

/**
 * Canonical list of auth roles, ordered by privilege (highest first).
 * Used by both server middleware and admin UI for role validation and display.
 */
export const AUTH_ROLES: SelectOption[] = [
	{ label: 'Admin', value: 'admin' },
	{ label: 'Editor', value: 'editor' },
	{ label: 'User', value: 'user' },
	{ label: 'Viewer', value: 'viewer' },
];

// ============================================
// auth-user — Better Auth "user" table
// ============================================

export const AuthUserCollection: CollectionConfig = defineCollection({
	slug: 'auth-user',
	dbName: 'user',
	timestamps: true,
	labels: { singular: 'User', plural: 'Users' },
	fields: [
		text('name', { required: true }),
		emailField('email', { required: true }),
		checkbox('emailVerified'),
		text('image'),
		select('role', {
			options: AUTH_ROLES,
			defaultValue: 'user',
		}),
	],
	indexes: [{ columns: ['email'], unique: true }],
	admin: {
		group: 'Authentication',
		useAsTitle: 'email',
		defaultColumns: ['name', 'email', 'role', 'createdAt'],
		description: 'Users authenticated via Better Auth',
	},
	access: {
		admin: ({ req }) => req.user?.role === 'admin',
		read: ({ req }) => req.user?.role === 'admin',
		create: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',
	},
});

// ============================================
// auth-session — Better Auth "session" table
// ============================================

export const AuthSessionCollection: CollectionConfig = defineCollection({
	slug: 'auth-session',
	dbName: 'session',
	managed: true,
	timestamps: true,
	fields: [
		text('userId', { required: true }),
		text('token', { required: true }),
		date('expiresAt', { required: true }),
		text('ipAddress'),
		text('userAgent'),
	],
	indexes: [{ columns: ['userId'] }, { columns: ['token'], unique: true }],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'Active user sessions',
	},
	access: {
		admin: ({ req }) => req.user?.role === 'admin',
		read: ({ req }) => req.user?.role === 'admin',
		create: () => false,
		update: () => false,
		delete: ({ req }) => req.user?.role === 'admin',
	},
});

// ============================================
// auth-account — Better Auth "account" table
// ============================================

export const AuthAccountCollection: CollectionConfig = defineCollection({
	slug: 'auth-account',
	dbName: 'account',
	managed: true,
	timestamps: true,
	fields: [
		text('userId', { required: true }),
		text('accountId', { required: true }),
		text('providerId', { required: true }),
		text('accessToken'),
		text('refreshToken'),
		date('accessTokenExpiresAt'),
		date('refreshTokenExpiresAt'),
		text('scope'),
		text('idToken'),
		text('password'),
	],
	indexes: [{ columns: ['userId'] }],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'OAuth and credential accounts',
	},
	access: {
		admin: ({ req }) => req.user?.role === 'admin',
		read: () => false, // Never expose OAuth tokens/password hashes via API — Better Auth owns this data
		create: () => false,
		update: () => false,
		delete: () => false,
	},
});

// ============================================
// auth-verification — Better Auth "verification" table
// ============================================

export const AuthVerificationCollection: CollectionConfig = defineCollection({
	slug: 'auth-verification',
	dbName: 'verification',
	managed: true,
	timestamps: true,
	fields: [
		text('identifier', { required: true }),
		text('value', { required: true }),
		date('expiresAt', { required: true }),
	],
	admin: {
		group: 'Authentication',
		hidden: true,
		description: 'Email verification and password reset tokens',
	},
	access: {
		admin: ({ req }) => req.user?.role === 'admin',
		read: () => false,
		create: () => false,
		update: () => false,
		delete: () => false,
	},
});

// ============================================
// auth-api-keys — Better Auth "_api_keys" table
// ============================================

export const AuthApiKeysCollection: CollectionConfig = defineCollection({
	slug: 'auth-api-keys',
	dbName: '_api_keys',
	timestamps: true,
	fields: [
		text('name', { required: true }),
		text('keyHash', { required: true, admin: { hidden: true }, access: { read: () => false } }),
		text('keyPrefix', { required: true }),
		relationship('createdBy', {
			required: true,
			collection: () => AuthUserCollection,
			label: 'Created By',
		}),
		select('role', {
			options: AUTH_ROLES,
			defaultValue: 'user',
		}),
		date('expiresAt'),
		date('lastUsedAt'),
	],
	indexes: [{ columns: ['keyHash'], unique: true }, { columns: ['createdBy'] }],
	admin: {
		group: 'Authentication',
		useAsTitle: 'name',
		defaultColumns: ['name', 'keyPrefix', 'role', 'createdBy', 'createdAt', 'lastUsedAt'],
		description: 'API keys for programmatic access',
		headerActions: [
			{ id: 'generate-key', label: 'Generate API Key', endpoint: '/api/auth/api-keys' },
		],
	},
	access: {
		admin: ({ req }) => !!req.user,
		read: ({ req }) => !!req.user,
		create: () => false, // API keys must be created through dedicated /api/auth/api-keys endpoint
		update: () => false,
		delete: () => false, // Deletion only via dedicated /api/auth/api-keys/:id (has ownership checks)
	},
	defaultWhere: (req) => {
		if (!req.user) return { createdBy: '__none__' };
		if (req.user.role === 'admin') return undefined;
		return { createdBy: req.user.id };
	},
});

/**
 * All base auth collections.
 * These are injected into the Momentum config by the auth plugin's onInit.
 */
export const BASE_AUTH_COLLECTIONS: CollectionConfig[] = [
	AuthUserCollection,
	AuthSessionCollection,
	AuthAccountCollection,
	AuthVerificationCollection,
	AuthApiKeysCollection,
];

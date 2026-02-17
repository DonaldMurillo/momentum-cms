/**
 * Browser-safe Auth Core Types & Constants
 *
 * This module contains ONLY types and constants that have zero Node.js dependencies.
 * It can be safely imported in browser contexts (admin UI, SSR client bundles)
 * without pulling in `better-auth`, `pg`, `nodemailer`, or other server-only packages.
 *
 * Server-only code (createMomentumAuth, email service, etc.) lives in `auth.ts`.
 */

import type { SelectOption } from '@momentumcms/core';

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

/**
 * User type from Better Auth with additional role field.
 */
export interface MomentumUser {
	id: string;
	email: string;
	name: string;
	role: string;
	emailVerified: boolean;
	twoFactorEnabled?: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Session type from Better Auth.
 */
export interface MomentumSession {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
}

/**
 * OAuth provider configuration.
 */
export interface OAuthProviderConfig {
	clientId: string;
	clientSecret: string;
	redirectURI?: string;
}

/**
 * Supported OAuth providers.
 */
export interface OAuthProvidersConfig {
	google?: OAuthProviderConfig;
	github?: OAuthProviderConfig;
}

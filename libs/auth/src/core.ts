/**
 * @momentumcms/auth/core
 *
 * Browser-safe entry point for auth types and constants.
 * Import from here in browser contexts (admin UI, SSR client bundles)
 * instead of `@momentumcms/auth` which pulls in Node.js dependencies.
 */
export {
	AUTH_ROLES,
	type MomentumUser,
	type MomentumSession,
	type OAuthProviderConfig,
	type OAuthProvidersConfig,
} from './lib/auth-core';

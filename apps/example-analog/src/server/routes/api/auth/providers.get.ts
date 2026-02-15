import { defineEventHandler } from 'h3';
import { getEnabledOAuthProviders } from '@momentum-cms/auth';

/**
 * GET /api/auth/providers
 *
 * Public endpoint that returns which OAuth providers are enabled.
 * Mirrors Express's createAuthMiddleware GET /auth/providers route.
 */
export default defineEventHandler(() => {
	// No social providers configured in the example — returns empty list
	const providers = getEnabledOAuthProviders();
	return { providers };
});

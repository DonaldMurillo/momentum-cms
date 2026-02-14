import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Database } from 'better-sqlite3';
import { createEmailService, type EmailConfig, type EmailService } from './email';
import { getPasswordResetEmail, getVerificationEmail } from './email-templates';
import { createLogger } from '@momentum-cms/logger';
import type { Field } from '@momentum-cms/core';

/**
 * Database configuration for Better Auth.
 * Supports both SQLite (better-sqlite3) and PostgreSQL (pg).
 */
export type DatabaseConfig =
	| { type: 'sqlite'; database: Database }
	| { type: 'postgres'; pool: Pool };

/**
 * Email configuration options for Momentum Auth.
 */
export interface MomentumEmailOptions extends EmailConfig {
	/** Enable email features (password reset, verification). Default: auto-detect from SMTP_HOST env var */
	enabled?: boolean;
	/** Application name shown in emails. Default: 'Momentum CMS' */
	appName?: string;
	/** Require email verification on signup. Default: false */
	requireEmailVerification?: boolean;
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

/**
 * Configuration options for Momentum Auth.
 */
export interface MomentumAuthConfig {
	/** Database configuration - supports SQLite or PostgreSQL */
	db: DatabaseConfig;
	/** Base URL of the application (e.g., 'http://localhost:4000') */
	baseURL?: string;
	/** Secret key for signing tokens. Use env var AUTH_SECRET in production. */
	secret?: string;
	/** Trusted origins for CORS */
	trustedOrigins?: string[];
	/** Email configuration for password reset and verification */
	email?: MomentumEmailOptions;
	/** OAuth social login providers */
	socialProviders?: OAuthProvidersConfig;
	/** Enable two-factor authentication (TOTP). Default: false */
	twoFactorAuth?: boolean;
	/** Additional Better Auth plugins (from sub-plugins). */
	plugins?: unknown[];
	/** Extra user fields to register with Better Auth's user.additionalFields. */
	userFields?: Field[];
}

/**
 * Legacy configuration for SQLite (backwards compatibility).
 */
export interface MomentumAuthConfigLegacy {
	/** The better-sqlite3 database instance (deprecated, use db instead) */
	database: Database;
	/** Base URL of the application (e.g., 'http://localhost:4000') */
	baseURL?: string;
	/** Secret key for signing tokens. Use env var AUTH_SECRET in production. */
	secret?: string;
	/** Trusted origins for CORS */
	trustedOrigins?: string[];
	/** Email configuration for password reset and verification */
	email?: MomentumEmailOptions;
	/** OAuth social login providers */
	socialProviders?: OAuthProvidersConfig;
	/** Enable two-factor authentication (TOTP). Default: false */
	twoFactorAuth?: boolean;
}

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
 * Type guard to check if config uses the legacy format.
 */
function isLegacyConfig(
	config: MomentumAuthConfig | MomentumAuthConfigLegacy,
): config is MomentumAuthConfigLegacy {
	return 'database' in config && !('db' in config);
}

/**
 * Build social providers config from explicit config or environment variables.
 * Returns undefined if no providers are configured.
 */
function buildSocialProviders(
	config?: OAuthProvidersConfig,
	baseURL?: string,
): Record<string, OAuthProviderConfig> | undefined {
	const providers: Record<string, OAuthProviderConfig> = {};
	const resolvedBaseURL = baseURL ?? 'http://localhost:4000';

	// Google - explicit config or env vars
	const googleClientId = config?.google?.clientId ?? process.env['GOOGLE_CLIENT_ID'];
	const googleClientSecret = config?.google?.clientSecret ?? process.env['GOOGLE_CLIENT_SECRET'];
	if (googleClientId && googleClientSecret) {
		providers['google'] = {
			clientId: googleClientId,
			clientSecret: googleClientSecret,
			redirectURI: config?.google?.redirectURI ?? `${resolvedBaseURL}/api/auth/callback/google`,
		};
	}

	// GitHub - explicit config or env vars
	const githubClientId = config?.github?.clientId ?? process.env['GITHUB_CLIENT_ID'];
	const githubClientSecret = config?.github?.clientSecret ?? process.env['GITHUB_CLIENT_SECRET'];
	if (githubClientId && githubClientSecret) {
		providers['github'] = {
			clientId: githubClientId,
			clientSecret: githubClientSecret,
			redirectURI: config?.github?.redirectURI ?? `${resolvedBaseURL}/api/auth/callback/github`,
		};
	}

	return Object.keys(providers).length > 0 ? providers : undefined;
}

/**
 * Get the list of enabled OAuth provider names from config/env vars.
 * Useful for exposing available providers to the client.
 */
export function getEnabledOAuthProviders(config?: OAuthProvidersConfig): string[] {
	const providers: string[] = [];

	const googleClientId = config?.google?.clientId ?? process.env['GOOGLE_CLIENT_ID'];
	const googleClientSecret = config?.google?.clientSecret ?? process.env['GOOGLE_CLIENT_SECRET'];
	if (googleClientId && googleClientSecret) {
		providers.push('google');
	}

	const githubClientId = config?.github?.clientId ?? process.env['GITHUB_CLIENT_ID'];
	const githubClientSecret = config?.github?.clientSecret ?? process.env['GITHUB_CLIENT_SECRET'];
	if (githubClientId && githubClientSecret) {
		providers.push('github');
	}

	return providers;
}

/**
 * Converts Momentum Field definitions to Better Auth's additionalFields format.
 * Maps field types to the equivalent Better Auth type strings.
 */
function convertFieldsToAdditionalFields(
	fields: Field[],
): Record<string, { type: string; required?: boolean; defaultValue?: unknown; input?: boolean }> {
	const result: Record<
		string,
		{ type: string; required?: boolean; defaultValue?: unknown; input?: boolean }
	> = {};
	for (const field of fields) {
		let baType: string;
		switch (field.type) {
			case 'checkbox':
				baType = 'boolean';
				break;
			case 'number':
				baType = 'number';
				break;
			case 'date':
				baType = 'string'; // Better Auth stores dates as strings
				break;
			default:
				baType = 'string';
				break;
		}
		result[field.name] = {
			type: baType,
			required: field.required ?? false,
			input: false, // Sub-plugin fields are not user-settable by default
		};
	}
	return result;
}

/**
 * Creates a Momentum Auth instance using Better Auth.
 *
 * @example
 * ```typescript
 * import { createMomentumAuth } from '@momentum-cms/auth';
 *
 * // With PostgreSQL
 * const auth = createMomentumAuth({
 *   db: { type: 'postgres', pool: pgPool },
 *   baseURL: 'http://localhost:4000',
 *   secret: process.env.AUTH_SECRET,
 * });
 *
 * // With SQLite (legacy)
 * const auth = createMomentumAuth({
 *   database: sqliteDb,
 *   baseURL: 'http://localhost:4000',
 *   secret: process.env.AUTH_SECRET,
 * });
 *
 * // Use in Express
 * app.all('/api/auth/*', toNodeHandler(auth));
 * ```
 */
export function createMomentumAuth(
	config: MomentumAuthConfig | MomentumAuthConfigLegacy,
): ReturnType<typeof betterAuth> {
	// Handle legacy config format
	const dbConfig: DatabaseConfig = isLegacyConfig(config)
		? { type: 'sqlite', database: config.database }
		: config.db;

	const {
		baseURL,
		secret,
		trustedOrigins,
		email: emailConfig,
		socialProviders,
		twoFactorAuth,
	} = config;

	// Extract new plugin-related fields (only present on MomentumAuthConfig, not legacy)
	const extraPlugins = !isLegacyConfig(config) ? (config.plugins ?? []) : [];
	const extraUserFields = !isLegacyConfig(config) ? (config.userFields ?? []) : [];

	// Configure database based on type
	// Better Auth auto-detects the database type from the instance:
	// - better-sqlite3 Database: detected via 'prepare' method
	// - pg Pool: detected via 'connect' method
	const databaseOption = dbConfig.type === 'sqlite' ? dbConfig.database : dbConfig.pool;

	// Determine if email is enabled
	// Priority: explicit config > SMTP_HOST env var presence
	const emailEnabled = emailConfig?.enabled ?? !!process.env['SMTP_HOST'];
	const appName = emailConfig?.appName ?? 'Momentum CMS';

	// Create email service if email is enabled
	let emailService: EmailService | null = null;
	if (emailEnabled) {
		emailService = createEmailService(emailConfig);
	}

	// Build email/password config
	const emailAndPasswordConfig: {
		enabled: boolean;
		minPasswordLength: number;
		requireEmailVerification?: boolean;
		sendResetPassword?: (params: {
			user: { email: string; name: string };
			url: string;
			token: string;
		}) => Promise<void>;
	} = {
		enabled: true,
		minPasswordLength: 8,
	};

	// Add password reset callback if email is enabled
	if (emailService) {
		emailAndPasswordConfig.sendResetPassword = async ({ user, url }) => {
			const { subject, text, html } = getPasswordResetEmail({
				name: user.name,
				url,
				appName,
				expiresIn: '1 hour',
			});
			// Don't await to prevent timing attacks, but log errors for debugging
			emailService
				.sendEmail({
					to: user.email,
					subject,
					text,
					html,
				})
				.catch((err: unknown) => {
					createLogger('Auth').error(
						`Failed to send password reset email: ${err instanceof Error ? err.message : String(err)}`,
					);
				});
		};
	}

	// Build email verification config if enabled
	const requireVerification = emailConfig?.requireEmailVerification ?? false;
	const emailVerificationConfig = emailService
		? {
				sendOnSignUp: true,
				autoSignInAfterVerification: true,
				expiresIn: 86400, // 24 hours
				sendVerificationEmail: async ({
					user,
					url,
				}: {
					user: { email: string; name: string };
					url: string;
					token: string;
				}) => {
					const { subject, text, html } = getVerificationEmail({
						name: user.name,
						url,
						appName,
						expiresIn: '24 hours',
					});
					// Don't await to prevent timing attacks, but log errors for debugging
					emailService
						.sendEmail({
							to: user.email,
							subject,
							text,
							html,
						})
						.catch((err: unknown) => {
							createLogger('Auth').error(
								`Failed to send verification email: ${err instanceof Error ? err.message : String(err)}`,
							);
						});
				},
			}
		: undefined;

	// If requireEmailVerification is set, login should be blocked for unverified users
	if (requireVerification && emailAndPasswordConfig) {
		emailAndPasswordConfig.requireEmailVerification = true;
	}

	// Build social providers config from env vars or explicit config
	const socialProvidersConfig = buildSocialProviders(socialProviders, baseURL);

	// Build plugins array
	const plugins: unknown[] = [];
	if (twoFactorAuth) {
		plugins.push(twoFactor());
	}
	// Merge sub-plugin Better Auth plugins (filter out undefined stubs)
	for (const p of extraPlugins) {
		if (p !== undefined) {
			plugins.push(p);
		}
	}

	return betterAuth({
		database: databaseOption,
		baseURL: baseURL ?? 'http://localhost:4000',
		secret: secret ?? process.env['AUTH_SECRET'] ?? 'momentum-cms-dev-secret-change-in-production',
		trustedOrigins: trustedOrigins ?? [baseURL ?? 'http://localhost:4000'],

		// Enable email/password authentication with optional password reset
		emailAndPassword: emailAndPasswordConfig,

		// Email verification (only if email is enabled)
		...(emailVerificationConfig && { emailVerification: emailVerificationConfig }),

		// Social login providers (only if configured)
		...(socialProvidersConfig && { socialProviders: socialProvidersConfig }),

		// Plugins (2FA, etc.)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Better Auth plugin types are opaque from sub-plugins
		...(plugins.length > 0 && { plugins: plugins as any[] }),

		// Add custom role field to users + any extra user fields from sub-plugins.
		// Base role is spread AFTER sub-plugin fields so it cannot be overwritten
		// (a sub-plugin field named 'role' would lose defaultValue and input protection).
		user: {
			additionalFields: {
				// Convert Momentum Field definitions to Better Auth additionalFields format
				...convertFieldsToAdditionalFields(extraUserFields.filter((f) => f.name !== 'role')),
				role: {
					type: 'string',
					required: false,
					defaultValue: 'user',
					input: false, // Don't allow users to set their own role
				},
			},
		},

		// Session configuration
		// Note: cookieCache is intentionally disabled. It caches session data
		// (including role) in a signed cookie, which causes stale role issues
		// when roles are updated after session creation (e.g., setup flow).
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // Update session every 24 hours
		},
	});
}

/**
 * Type for the Momentum Auth instance.
 */
export type MomentumAuth = ReturnType<typeof createMomentumAuth>;

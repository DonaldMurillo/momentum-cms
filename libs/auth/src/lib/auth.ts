import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import type { Database } from 'better-sqlite3';
import { createEmailService, type EmailConfig, type EmailService } from './email';
import { getPasswordResetEmail, getVerificationEmail } from './email-templates';

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

	const { baseURL, secret, trustedOrigins, email: emailConfig } = config;

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
				.catch((err) => {
					console.error('[MomentumAuth] Failed to send password reset email:', err);
				});
		};
	}

	// Build email verification config if enabled
	const emailVerificationConfig = emailService
		? {
				sendVerificationEmail: async ({
					user,
					url,
				}: {
					user: { email: string; name: string };
					url: string;
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
						.catch((err) => {
							console.error('[MomentumAuth] Failed to send verification email:', err);
						});
				},
			}
		: undefined;

	return betterAuth({
		database: databaseOption,
		baseURL: baseURL ?? 'http://localhost:4000',
		secret: secret ?? process.env['AUTH_SECRET'] ?? 'momentum-cms-dev-secret-change-in-production',
		trustedOrigins: trustedOrigins ?? [baseURL ?? 'http://localhost:4000'],

		// Enable email/password authentication with optional password reset
		emailAndPassword: emailAndPasswordConfig,

		// Email verification (only if email is enabled)
		...(emailVerificationConfig && { emailVerification: emailVerificationConfig }),

		// Add custom role field to users
		user: {
			additionalFields: {
				role: {
					type: 'string',
					required: false,
					defaultValue: 'user',
					input: false, // Don't allow users to set their own role
				},
			},
		},

		// Session configuration
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // Update session every 24 hours
			cookieCache: {
				enabled: true,
				maxAge: 60 * 5, // 5 minutes
			},
		},
	});
}

/**
 * Type for the Momentum Auth instance.
 */
export type MomentumAuth = ReturnType<typeof createMomentumAuth>;

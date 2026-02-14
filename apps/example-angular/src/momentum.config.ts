import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import { momentumAuth } from '@momentum-cms/auth';
import type { PostgresAdapterWithRaw } from '@momentum-cms/db-drizzle';
import { Posts } from './collections';
import { SiteSettings } from './globals';

/**
 * Database adapter — shared between Momentum and the auth plugin.
 */
const dbAdapter = postgresAdapter({
	connectionString:
		process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/momentum',
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (dbAdapter as PostgresAdapterWithRaw).getPool();

const authBaseURL =
	process.env['BETTER_AUTH_URL'] || `http://localhost:${process.env['PORT'] || 4000}`;

/**
 * Auth plugin — manages Better Auth integration, user tables, and middleware.
 */
export const authPlugin = momentumAuth({
	db: { type: 'postgres', pool },
	baseURL: authBaseURL,
	trustedOrigins: ['http://localhost:4200', authBaseURL],
	email: {
		appName: 'Momentum CMS',
	},
});

/**
 * Momentum CMS Configuration
 *
 * This is the main entry point for configuring the CMS.
 * Similar to Payload CMS's payload.config.ts pattern.
 */
export default defineMomentumConfig({
	db: { adapter: dbAdapter },
	collections: [Posts],
	globals: [SiteSettings],
	plugins: [authPlugin],
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Momentum CMS',
		},
	},
	server: {
		port: 4000,
		cors: {
			// WARNING: Use specific origins in production (e.g. process.env['CORS_ORIGIN'])
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization'],
		},
	},
});

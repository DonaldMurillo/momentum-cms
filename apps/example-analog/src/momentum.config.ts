import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import type { PostgresAdapterWithRaw } from '@momentum-cms/db-drizzle';
import { momentumAuth } from '@momentum-cms/auth';
import { localStorageAdapter } from '@momentum-cms/storage';
import { eventBusPlugin } from '@momentum-cms/plugins/core';
import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentum-cms/plugins/analytics';
import { join } from 'node:path';
import { collections } from '@momentum-cms/example-config/collections';
import { globals } from '@momentum-cms/example-config/globals';
import { exampleSeedingConfig } from '@momentum-cms/example-config';

/**
 * Database adapter — shared between Momentum and the auth plugin.
 * Uses PostgreSQL to match the Angular example and E2E test infrastructure.
 */
const dbAdapter = postgresAdapter({
	connectionString:
		process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/momentum',
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (dbAdapter as PostgresAdapterWithRaw).getPool();

const authBaseURL =
	process.env['BETTER_AUTH_URL'] || `http://localhost:${process.env['PORT'] || 4200}`;

/**
 * Auth plugin — manages Better Auth integration, user tables, and middleware.
 */
export const authPlugin = momentumAuth({
	db: { type: 'postgres', pool },
	baseURL: authBaseURL,
	trustedOrigins: ['http://localhost:4000', authBaseURL],
	email: {
		appName: 'Momentum CMS',
	},
});

/**
 * Plugin instances — exported for test endpoint wiring in server routes.
 */
export const analyticsAdapter = new MemoryAnalyticsAdapter();
export const events = eventBusPlugin();
export const analytics = analyticsPlugin({
	adapter: analyticsAdapter,
	trackCollections: true,
	trackApi: true,
	flushInterval: 1000, // 1s for fast E2E feedback
	flushBatchSize: 10,
	ingestRateLimit: 10, // Low for rate-limiting E2E test
	excludeCollections: ['_seed_tracking'],
	adminDashboard: true,
	trackingRules: { cacheTtl: 0 }, // No cache for E2E testing
});

/**
 * Momentum CMS configuration.
 *
 * Collections, globals, and seeding data are imported from @momentum-cms/example-config.
 * DB adapter, auth, and plugins are configured here since they depend on runtime env vars.
 */
const config = defineMomentumConfig({
	db: { adapter: dbAdapter },
	collections,
	globals,
	storage: {
		adapter: localStorageAdapter({
			directory: join(process.cwd(), 'data', 'uploads'),
		}),
	},
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Momentum CMS',
		},
	},
	server: {
		port: Number(process.env['PORT']) || 4200,
		cors: {
			// WARNING: Use specific origins in production (e.g. process.env['CORS_ORIGIN'])
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization', 'X-API-Key'],
		},
	},
	logging: {
		level: 'debug',
		format: 'pretty',
	},
	plugins: [events, analytics, authPlugin],
	seeding: exampleSeedingConfig,
});

export default config;

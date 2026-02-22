import { defineMomentumConfig } from '@momentumcms/core';
import { postgresAdapter } from '@momentumcms/db-drizzle';
import type { PostgresAdapterWithRaw } from '@momentumcms/db-drizzle';
import { momentumAuth } from '@momentumcms/auth';
import { localStorageAdapter } from '@momentumcms/storage';
import { eventBusPlugin } from '@momentumcms/plugins/core';
import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentumcms/plugins/analytics';
import { seoPlugin } from '@momentumcms/plugins/seo';
import { join } from 'node:path';
import { collections } from '@momentumcms/example-config/collections';
import { globals } from '@momentumcms/example-config/globals';
import { exampleSeedingConfig } from '@momentumcms/example-config';

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
 * Plugin instances — exported for test endpoint wiring in server.ts.
 */
export const analyticsAdapter = new MemoryAnalyticsAdapter();
export const events = eventBusPlugin();
export const analytics = analyticsPlugin({
	adapter: analyticsAdapter,
	trackCollections: true,
	trackApi: true,
	trackPageViews: {
		contentRoutes: {
			articles: '/articles/:slug',
			categories: '/categories/:slug',
			pages: '/:slug',
		},
	},
	flushInterval: 1000, // 1s for fast E2E feedback
	flushBatchSize: 10,
	ingestRateLimit: 10, // Low for rate-limiting E2E test
	excludeCollections: ['_seed_tracking'],
	adminDashboard: true,
	trackingRules: { cacheTtl: 0 }, // No cache for E2E testing
});

export const seo = seoPlugin({
	collections: ['categories', 'articles', 'pages'],
	siteUrl: `http://localhost:${process.env['PORT'] || 4000}`,
	analysis: true,
	sitemap: true,
	robots: true,
	metaApi: true,
	adminDashboard: true,
});

/**
 * Momentum CMS configuration.
 *
 * Collections, globals, and seeding data are imported from @momentumcms/example-config.
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
		port: Number(process.env['PORT']) || 4000,
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
	plugins: [events, analytics, seo, authPlugin],
	seeding: exampleSeedingConfig,
});

export default config;

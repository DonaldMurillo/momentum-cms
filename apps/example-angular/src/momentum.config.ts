import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import { Posts, Users } from './collections';

/**
 * Momentum CMS Configuration
 *
 * This is the main entry point for configuring the CMS.
 * Similar to Payload CMS's payload.config.ts pattern.
 */
export default defineMomentumConfig({
	db: {
		adapter: postgresAdapter({
			connectionString:
				process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/momentum',
		}),
	},
	collections: [Posts, Users],
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

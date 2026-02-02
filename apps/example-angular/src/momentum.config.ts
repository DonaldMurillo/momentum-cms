import { defineMomentumConfig } from '@momentum-cms/core';
import { sqliteAdapter } from '@momentum-cms/db-drizzle';
import { Posts, Users } from './collections';

/**
 * Momentum CMS Configuration
 *
 * This is the main entry point for configuring the CMS.
 * Similar to Payload CMS's payload.config.ts pattern.
 */
export default defineMomentumConfig({
	db: {
		adapter: sqliteAdapter({
			filename: './data/momentum.db',
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
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization'],
		},
	},
});

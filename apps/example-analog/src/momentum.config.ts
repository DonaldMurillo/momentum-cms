import { defineMomentumConfig, MediaCollection } from '@momentum-cms/core';
import { sqliteAdapter } from '@momentum-cms/db-drizzle';
import { Posts, Users } from './collections';

/**
 * Momentum CMS Configuration for Analog.js Example
 *
 * Uses SQLite for simplicity - no external database required.
 * The database file is stored in the data/ directory.
 */
export default defineMomentumConfig({
	db: {
		adapter: sqliteAdapter({
			filename: process.env['DATABASE_PATH'] ?? './data/momentum.db',
		}),
	},
	// Include built-in MediaCollection for file uploads
	collections: [Posts, Users, MediaCollection],
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Momentum CMS',
		},
	},
	server: {
		port: 4200,
		cors: {
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization'],
		},
	},
});

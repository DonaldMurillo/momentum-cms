/**
 * Seed script for example-analog app.
 * Run with: node apps/example-analog/scripts/seed.cjs
 *
 * Creates an admin user for E2E testing:
 * - Email: admin@example.com
 * - Password: password123
 */

const { sqliteAdapter } = require('../../../dist/libs/db-drizzle/index.cjs');
const { initializeMomentumAPI, getMomentumAPI } = require('../../../dist/libs/server-core/index.cjs');
const { MediaCollection } = require('../../../dist/libs/core/index.cjs');

// Define collections inline (simplified for seeding)
const Users = {
	slug: 'users',
	labels: { singular: 'User', plural: 'Users' },
	fields: [
		{ name: 'name', type: 'text', required: true, label: 'Name' },
		{ name: 'email', type: 'email', required: true, label: 'Email' },
		{ name: 'authId', type: 'text', label: 'Auth ID' },
		{ name: 'role', type: 'select', required: true, label: 'Role', options: [
			{ label: 'Admin', value: 'admin' },
			{ label: 'Editor', value: 'editor' },
			{ label: 'Viewer', value: 'viewer' },
		]},
		{ name: 'active', type: 'checkbox', label: 'Active' },
	],
	access: {
		read: () => true,
		create: () => true,
		update: () => true,
		delete: () => true,
	},
};

const Posts = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'slug', type: 'text', required: true, label: 'URL Slug' },
		{ name: 'content', type: 'textarea', label: 'Content' },
		{ name: 'status', type: 'select', label: 'Status', options: [
			{ label: 'Draft', value: 'draft' },
			{ label: 'Published', value: 'published' },
			{ label: 'Archived', value: 'archived' },
		]},
		{ name: 'featured', type: 'checkbox', label: 'Featured Post' },
	],
	access: {
		read: () => true,
		create: () => true,
		update: () => true,
		delete: () => true,
	},
};

async function seed() {
	console.log('[Seed] Initializing database...');

	// Create adapter
	const adapter = sqliteAdapter({
		filename: process.env.DATABASE_PATH || './data/momentum.db',
	});

	const config = {
		db: { adapter },
		collections: [Posts, Users, MediaCollection],
	};

	// Initialize database schema
	if (adapter.initialize) {
		await adapter.initialize(config.collections);
	}

	// Initialize Momentum API
	initializeMomentumAPI(config);
	const api = getMomentumAPI();

	// Use system context to bypass access control
	const systemApi = api.setContext({
		user: { id: 'system', email: 'system@localhost', role: 'admin' },
	});

	console.log('[Seed] Checking for existing admin user...');

	// Check if admin user already exists
	const usersCollection = systemApi.collection('users');
	const existingUsers = await usersCollection.find({ limit: 1000 });
	const adminExists = existingUsers.docs.some((u) => u.email === 'admin@example.com');

	if (adminExists) {
		console.log('[Seed] Admin user already exists. Skipping creation.');
	} else {
		console.log('[Seed] Creating admin user...');

		await usersCollection.create({
			name: 'Admin',
			email: 'admin@example.com',
			role: 'admin',
			active: true,
		});

		console.log('[Seed] Admin user created successfully.');
		console.log('[Seed] Credentials: admin@example.com / password123');
	}

	console.log('[Seed] Seed completed.');
	process.exit(0);
}

seed().catch((error) => {
	console.error('[Seed] Error:', error);
	process.exit(1);
});

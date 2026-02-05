/* eslint-disable no-console -- CLI seed script uses console for status output */
/**
 * Seed script for example-analog app.
 *
 * Creates an admin user for E2E testing:
 * - Email: admin@example.com
 * - Password: password123
 *
 * Usage: npx tsx apps/example-analog/src/seed.ts
 */

import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from './momentum.config';

async function seed(): Promise<void> {
	console.log('[Seed] Initializing database...');

	// Initialize database schema
	if (momentumConfig.db.adapter.initialize) {
		await momentumConfig.db.adapter.initialize(momentumConfig.collections);
	}

	// Initialize Momentum API
	initializeMomentumAPI(momentumConfig);
	const api = getMomentumAPI();

	// Use system context to bypass access control
	const systemApi = api.setContext({
		user: { id: 'system', email: 'system@localhost', role: 'admin' },
	});

	console.log('[Seed] Checking for existing admin user...');

	// Check if admin user already exists
	const usersCollection = systemApi.collection<{
		id: string;
		email: string;
		name: string;
		role: string;
	}>('users');

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

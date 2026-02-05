import { defineEventHandler } from 'h3';
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../../momentum.config';

// Initialize Momentum API on first request
let initialized = false;

/**
 * GET /api/setup/status
 * Returns the setup status indicating if initial setup is needed.
 */
export default defineEventHandler(async () => {
	// Initialize Momentum API if not already done
	if (!initialized) {
		await momentumConfig.db.adapter.initialize?.(momentumConfig.collections);
		initializeMomentumAPI(momentumConfig);
		initialized = true;
	}

	const api = getMomentumAPI();

	// Use system context to check for users
	const systemApi = api.setContext({
		user: { id: 'system', email: 'system@localhost', role: 'admin' },
	});

	try {
		// Check if any users exist
		const usersCollection = systemApi.collection('users');
		const result = await usersCollection.find({ limit: 1 });
		const hasUsers = result.docs.length > 0;

		return {
			needsSetup: !hasUsers,
			hasUsers,
		};
	} catch (error) {
		// If checking fails, assume setup is needed for safety
		console.error('[Setup] Error checking status:', error);
		return {
			needsSetup: true,
			hasUsers: false,
		};
	}
});

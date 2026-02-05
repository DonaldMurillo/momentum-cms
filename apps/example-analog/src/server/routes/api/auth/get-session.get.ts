import { defineEventHandler, getCookie } from 'h3';
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../../momentum.config';
import { sessions } from '../../../utils/sessions';

// Initialize Momentum API on first request
let initialized = false;

/**
 * GET /api/auth/get-session
 * Returns the current user session if authenticated.
 */
export default defineEventHandler(async (event) => {
	// Initialize Momentum API if not already done
	if (!initialized) {
		await momentumConfig.db.adapter.initialize?.(momentumConfig.collections);
		initializeMomentumAPI(momentumConfig);
		initialized = true;
	}

	const sessionId = getCookie(event, 'momentum_session');

	if (!sessionId) {
		return { user: null };
	}

	const session = sessions.get(sessionId);

	if (!session) {
		return { user: null };
	}

	const api = getMomentumAPI();

	// Use system context to get user details
	const systemApi = api.setContext({
		user: { id: 'system', email: 'system@localhost', role: 'admin' },
	});

	try {
		const usersCollection = systemApi.collection('users');
		const user = await usersCollection.findById(session.userId);

		if (!user) {
			// Session references a user that no longer exists
			sessions.delete(sessionId);
			return { user: null };
		}

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	} catch (error) {
		console.error('[Auth] Get session error:', error);
		return { user: null };
	}
});

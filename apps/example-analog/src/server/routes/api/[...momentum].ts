import {
	defineEventHandler,
	readBody,
	getQuery,
	getRouterParams,
	setResponseStatus,
	getCookie,
} from 'h3';
import { createSimpleMomentumHandler } from '@momentum-cms/server-analog';
import { initializeMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../momentum.config';
import { sessions } from '../../utils/sessions';

// Initialize Momentum API on first request
let initialized = false;
let handler: ReturnType<typeof createSimpleMomentumHandler>;

/**
 * Catch-all API handler for Momentum CMS collections.
 * Handles: GET/POST/PATCH/PUT/DELETE on /api/:collection/:id
 */
export default defineEventHandler(async (event) => {
	// Initialize Momentum API if not already done
	if (!initialized) {
		await momentumConfig.db.adapter.initialize?.(momentumConfig.collections);
		initializeMomentumAPI(momentumConfig);
		handler = createSimpleMomentumHandler(momentumConfig);
		initialized = true;
	}

	// Get user context from session
	const sessionId = getCookie(event, 'momentum_session');
	let user: { id: string; email: string; role: string } | undefined;

	if (sessionId) {
		const session = sessions.get(sessionId);
		if (session) {
			user = { id: session.userId, email: session.email, role: session.role };
		}
	}

	// Attach user to event context for access control
	if (user) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- h3 event context augmentation
		(event.context as any).user = user;
	}

	// Call the Momentum handler
	return handler(event, {
		readBody,
		getQuery,
		getRouterParams,
		setResponseStatus,
	});
});

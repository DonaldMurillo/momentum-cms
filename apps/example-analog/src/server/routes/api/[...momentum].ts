import {
	defineEventHandler,
	readBody,
	getQuery,
	getRouterParams,
	setResponseStatus,
	getHeaders,
} from 'h3';
import { createSimpleMomentumHandler } from '@momentum-cms/server-analog';
import { ensureInitialized, getAuth } from '../../utils/momentum-init';
import momentumConfig from '../../../momentum.config';

let handler: ReturnType<typeof createSimpleMomentumHandler>;

/**
 * Catch-all API handler for Momentum CMS collections.
 * Handles: GET/POST/PATCH/PUT/DELETE on /api/:collection/:id
 *
 * Uses Better Auth for session resolution (replaces in-memory sessions).
 */
export default defineEventHandler(async (event) => {
	// Ensure full initialization (plugins, DB, seeding) has completed
	await ensureInitialized();

	if (!handler) {
		handler = createSimpleMomentumHandler(momentumConfig);
	}

	// Resolve user session via Better Auth
	const auth = getAuth();
	if (auth) {
		try {
			const session = await auth.api.getSession({
				headers: getHeaders(event),
			});
			if (session) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- h3 event context augmentation
				(event.context as any).user = {
					id: session.user.id,
					email: session.user.email,
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type doesn't include custom fields
					role: (session.user as Record<string, unknown>).role ?? 'user',
				};
			}
		} catch {
			// Session validation failed — continue without auth
		}
	}

	// Call the Momentum handler
	return handler(event, {
		readBody,
		getQuery,
		getRouterParams,
		setResponseStatus,
	});
});

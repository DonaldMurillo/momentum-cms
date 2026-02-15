import {
	defineEventHandler,
	readBody,
	getQuery,
	getRouterParams,
	setResponseStatus,
	setResponseHeader,
	readMultipartFormData,
	send,
	getHeaders,
} from 'h3';
import { createComprehensiveMomentumHandler } from '@momentum-cms/server-analog';
import { ensureInitialized, getAuth } from '../../utils/momentum-init';
import momentumConfig from '../../../momentum.config';

let handler: ReturnType<typeof createComprehensiveMomentumHandler>;

/**
 * Catch-all API handler for Momentum CMS.
 * Handles all collection CRUD, globals, versioning, publishing, media,
 * GraphQL, batch operations, search, import/export, and custom endpoints.
 *
 * Uses Better Auth for session resolution.
 */
export default defineEventHandler(async (event) => {
	// Ensure full initialization (plugins, DB, seeding) has completed
	await ensureInitialized();

	if (!handler) {
		handler = createComprehensiveMomentumHandler(momentumConfig);
	}

	// Resolve user session via Better Auth
	let user: { id: string; email?: string; role?: string } | undefined;
	const auth = getAuth();
	if (auth) {
		try {
			const rawHeaders = getHeaders(event);
			const headers = new Headers();
			for (const [key, value] of Object.entries(rawHeaders)) {
				if (value != null) {
					headers.set(key, value);
				}
			}
			const session = await auth.api.getSession({ headers });
			if (session) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type doesn't include custom fields
				const userRecord = session.user as Record<string, unknown>;
				const role = typeof userRecord['role'] === 'string' ? userRecord['role'] : 'user';
				user = {
					id: session.user.id,
					email: session.user.email,
					role,
				};
			}
		} catch {
			// Session validation failed — continue without auth
		}
	}

	// Call the comprehensive Momentum handler
	return handler(
		event,
		{
			readBody,
			getQuery,
			getRouterParams,
			setResponseStatus,
			setResponseHeader,
			readMultipartFormData,
			send,
		},
		{ user },
	);
});

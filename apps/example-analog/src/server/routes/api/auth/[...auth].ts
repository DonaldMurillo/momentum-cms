import { defineEventHandler, toWebRequest } from 'h3';
import { ensureInitialized, getAuth } from '../../../utils/momentum-init';

/**
 * Catch-all auth handler for Better Auth.
 * Handles: /api/auth/sign-in/email, /api/auth/sign-up/email, /api/auth/sign-out,
 *          /api/auth/get-session, /api/auth/callback/*, etc.
 *
 * Uses Better Auth's Web API handler: converts h3 event to Web Request,
 * passes it to Better Auth, and returns the Web Response.
 */
export default defineEventHandler(async (event) => {
	await ensureInitialized();

	const auth = getAuth();
	if (!auth) {
		return { error: 'Auth not initialized' };
	}

	// Better Auth's handler accepts a Web Request and returns a Web Response
	const webRequest = toWebRequest(event);
	const response = await auth.handler(webRequest);
	return response;
});

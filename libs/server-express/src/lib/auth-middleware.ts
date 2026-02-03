import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { MomentumAuth } from '@momentum-cms/auth';

/**
 * Extended Request type with auth session data.
 */
export interface AuthenticatedRequest extends Request {
	user?: unknown;
	authSession?: unknown;
}

/**
 * Converts Express request headers to Record<string, string> for Better Auth.
 */
function headersToRecord(headers: Request['headers']): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (typeof value === 'string') {
			result[key] = value;
		} else if (Array.isArray(value)) {
			result[key] = value.join(', ');
		}
	}
	return result;
}

/**
 * Creates Express middleware to handle Better Auth routes.
 *
 * Mounts Better Auth at /auth/* path. All auth endpoints like
 * /auth/sign-in/email, /auth/sign-up/email, /auth/sign-out, /auth/get-session
 * are automatically handled.
 *
 * @example
 * ```typescript
 * import { createAuthMiddleware } from '@momentum-cms/server-express';
 * import { createMomentumAuth } from '@momentum-cms/auth';
 *
 * const auth = createMomentumAuth({ database });
 * app.use('/api', createAuthMiddleware(auth));
 * // Auth endpoints available at /api/auth/*
 * ```
 */
export function createAuthMiddleware(auth: MomentumAuth): Router {
	const router = createRouter();

	// Mount Better Auth handler at /auth/*
	// This handles all auth endpoints: sign-in, sign-up, sign-out, get-session, etc.
	router.all('/auth/*', toNodeHandler(auth));

	return router;
}

/**
 * Middleware to protect routes that require authentication.
 *
 * Validates the session and attaches the user to the request.
 * Returns 401 if no valid session is found.
 *
 * @example
 * ```typescript
 * import { createProtectMiddleware } from '@momentum-cms/server-express';
 *
 * // Protect all collection routes
 * app.use('/api/collections', createProtectMiddleware(auth), collectionsRouter);
 * ```
 */
export function createProtectMiddleware(
	auth: MomentumAuth,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const session = await auth.api.getSession({
				headers: headersToRecord(req.headers),
			});

			if (!session) {
				res.status(401).json({ error: 'Unauthorized' });
				return;
			}

			// Attach user and session to request for downstream handlers
			req.user = session.user;
			req.authSession = session.session;

			next();
		} catch {
			res.status(401).json({ error: 'Unauthorized' });
		}
	};
}

/**
 * Configuration for session resolver middleware.
 */
export interface SessionResolverConfig {
	/**
	 * Optional function to look up user role from external source (e.g., Momentum users collection).
	 * Called with the user's email, should return the role string or undefined.
	 */
	getRoleByEmail?: (email: string) => Promise<string | undefined>;
}

/**
 * Middleware to resolve session for all requests (including SSR).
 *
 * Unlike createProtectMiddleware, this does NOT block unauthenticated requests.
 * It simply validates the session if cookies are present and attaches the user
 * to the request for use by Angular SSR.
 *
 * @example
 * ```typescript
 * import { createSessionResolverMiddleware } from '@momentum-cms/server-express';
 *
 * // Basic usage - resolve session for all requests
 * app.use(createSessionResolverMiddleware(auth));
 *
 * // With role lookup from Momentum users collection
 * app.use(createSessionResolverMiddleware(auth, {
 *   getRoleByEmail: async (email) => {
 *     const result = await api.collection('users').find({ where: { email: { equals: email } } });
 *     return result.docs[0]?.role;
 *   }
 * }));
 * ```
 */
export function createSessionResolverMiddleware(
	auth: MomentumAuth,
	config?: SessionResolverConfig,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const session = await auth.api.getSession({
				headers: headersToRecord(req.headers),
			});

			if (session) {
				// Build user object from session
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user structure
				const authUser = session.user as { id: string; email?: string; name?: string };
				let role: string | undefined;

				// Look up role from external source if configured
				if (config?.getRoleByEmail && authUser.email) {
					try {
						role = await config.getRoleByEmail(authUser.email);
					} catch {
						// Role lookup failed, continue without role
					}
				}

				// Attach user with role to request
				req.user = { ...authUser, role };
				req.authSession = session.session;
			}
		} catch {
			// Session validation failed - continue without auth
			// This is fine for SSR, client will handle unauthenticated state
		}

		next();
	};
}

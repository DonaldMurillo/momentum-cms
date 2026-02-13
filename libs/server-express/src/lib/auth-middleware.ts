import type { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { Router as createRouter } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { MomentumAuth, MomentumAuthPlugin, OAuthProvidersConfig } from '@momentum-cms/auth';
import { getEnabledOAuthProviders } from '@momentum-cms/auth';

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
/**
 * Options for the auth middleware.
 */
export interface AuthMiddlewareOptions {
	/** OAuth providers config (used to expose enabled providers to the client) */
	socialProviders?: OAuthProvidersConfig;
}

export function createAuthMiddleware(auth: MomentumAuth, options?: AuthMiddlewareOptions): Router {
	const router = createRouter();

	// Expose which OAuth providers are enabled (public endpoint, no auth required)
	const enabledProviders = getEnabledOAuthProviders(options?.socialProviders);
	router.get('/auth/providers', (_req: Request, res: Response) => {
		res.json({ providers: enabledProviders });
	});

	// Mount Better Auth handler at /auth/*
	// This handles all auth endpoints: sign-in, sign-up, sign-out, get-session, etc.
	// Including social sign-in: /auth/sign-in/social, /auth/callback/{provider}
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
 * Middleware to resolve session for all requests (including SSR).
 *
 * Unlike createProtectMiddleware, this does NOT block unauthenticated requests.
 * It simply validates the session if cookies are present and attaches the user
 * to the request for use by Angular SSR.
 *
 * Role is read directly from the Better Auth user table (single source of truth).
 *
 * @example
 * ```typescript
 * import { createSessionResolverMiddleware } from '@momentum-cms/server-express';
 *
 * app.use(createSessionResolverMiddleware(auth));
 * ```
 */
export function createSessionResolverMiddleware(
	auth: MomentumAuth,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const session = await auth.api.getSession({
				headers: headersToRecord(req.headers),
			});

			if (session) {
				// Attach user and session to request — role comes from Better Auth user table
				req.user = session.user;
				req.authSession = session.session;
			}
		} catch {
			// Session validation failed - continue without auth
			// This is fine for SSR, client will handle unauthenticated state
		}

		// Built-in current-user endpoint: returns req.user
		if (req.method === 'GET' && req.path === '/api/me') {
			res.json({ user: req.user ?? null });
			return;
		}

		next();
	};
}

/**
 * Creates a deferred session resolver middleware for an auth plugin.
 *
 * This can be called at module scope before the auth plugin is initialized.
 * The middleware passes through (calls next()) until the auth instance is ready,
 * then resolves sessions normally.
 *
 * @example
 * ```typescript
 * import { createDeferredSessionResolver } from '@momentum-cms/server-express';
 * import { momentumAuth } from '@momentum-cms/auth';
 *
 * const authPlugin = momentumAuth({ ... });
 * app.use(createDeferredSessionResolver(authPlugin));
 * ```
 */
export function createDeferredSessionResolver(plugin: MomentumAuthPlugin): RequestHandler {
	let resolvedMiddleware:
		| ((req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>)
		| null = null;

	return (req: Request, res: Response, next: NextFunction): void => {
		const auth = plugin.tryGetAuth();
		if (!auth) {
			// Auth not ready yet — skip session resolution (server still initializing)
			next();
			return;
		}
		if (!resolvedMiddleware) {
			resolvedMiddleware = createSessionResolverMiddleware(auth);
		}
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation
		resolvedMiddleware(req as AuthenticatedRequest, res, next).catch(next);
	};
}

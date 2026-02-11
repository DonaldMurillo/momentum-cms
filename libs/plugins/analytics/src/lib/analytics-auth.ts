/**
 * Analytics Auth Utilities
 *
 * Shared authentication helpers for analytics endpoints.
 * Uses type guards (no `as` assertions) to check req.user set by auth middleware.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Check if the request has an authenticated user.
 * The auth middleware sets `req.user` before plugin handlers run.
 */
function isAuthenticated(req: Request): boolean {
	if (!('user' in req)) return false;
	const user: unknown = req['user'];
	return user != null && typeof user === 'object' && 'id' in user;
}

/**
 * Express middleware that requires authentication.
 * Returns 401 if no valid user session is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
	if (!isAuthenticated(req)) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}
	next();
}

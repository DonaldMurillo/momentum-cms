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
 * Check if the authenticated user has the admin role.
 */
function isAdmin(req: Request): boolean {
	if (!isAuthenticated(req)) return false;
	if (!('user' in req)) return false;
	const user: unknown = req['user'];
	return user != null && typeof user === 'object' && 'role' in user && user['role'] === 'admin';
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

/**
 * Express middleware that requires admin role.
 * Returns 401 if no session, 403 if not admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
	if (!isAuthenticated(req)) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}
	if (!isAdmin(req)) {
		res.status(403).json({ error: 'Admin access required' });
		return;
	}
	next();
}

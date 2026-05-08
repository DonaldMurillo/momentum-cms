import type { Request } from 'express';
import type { UserContext } from '@momentumcms/core';

interface RequestWithUser extends Request {
	user?: Partial<UserContext> | undefined;
}

/**
 * Pull a fully-resolved {@link UserContext} off an Express request.
 *
 * SessionMiddleware / ApiKeyGuard attach the user to `req.user`. Returns
 * undefined for unauthenticated requests or partial placeholders that lack
 * an `id` so handlers receive a clean optional value.
 */
export function extractUser(req: Request): UserContext | undefined {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation for req.user
	const user = (req as RequestWithUser).user;
	if (!user) return undefined;
	if (typeof user.id === 'string' && user.id) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by id presence above
		return user as UserContext;
	}
	if (typeof user.id === 'number' && Number.isFinite(user.id)) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by id presence above
		return user as UserContext;
	}
	return undefined;
}

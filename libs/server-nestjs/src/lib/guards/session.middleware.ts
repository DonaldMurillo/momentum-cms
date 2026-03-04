import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { UserContext } from '@momentumcms/core';

type SessionResolver = (req: Request) => Promise<UserContext | undefined>;

/**
 * Middleware that resolves the user session from cookies/headers.
 * Non-blocking: always calls next(), even if session resolution fails.
 * This mirrors createSessionResolverMiddleware from server-express.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
	private sessionResolver?: SessionResolver;

	setSessionResolver(resolver: SessionResolver): void {
		this.sessionResolver = resolver;
	}

	async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
		if (this.sessionResolver) {
			try {
				const user = await this.sessionResolver(req);
				if (user) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation
					(req as any).user = user;
				}
			} catch {
				// Session resolution failed — continue without user
			}
		}
		next();
	}
}

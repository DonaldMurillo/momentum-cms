import type { Request, Response, NextFunction } from 'express';
import type { RateLimiter } from '@momentumcms/server-core';

/**
 * Creates Express middleware that rate-limits requests using a RateLimiter instance.
 * Keys requests by IP address (supports X-Forwarded-For for proxied setups).
 *
 * @example
 * ```typescript
 * import { RateLimiter } from '@momentumcms/server-core';
 *
 * // 10 requests per minute on auth routes
 * app.use('/auth', createRateLimitMiddleware(new RateLimiter(10)));
 *
 * // 3 requests per minute on setup
 * app.use('/setup', createRateLimitMiddleware(new RateLimiter(3)));
 * ```
 */
export function createRateLimitMiddleware(
	limiter: RateLimiter,
): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction): void => {
		// Prefer X-Forwarded-For (real client IP behind proxy), then fall back to req.ip
		const forwarded = req.headers['x-forwarded-for'];
		const key = (forwarded ? forwarded.toString().split(',')[0].trim() : req.ip) ?? 'unknown';

		if (!limiter.isAllowed(key)) {
			res.setHeader('Retry-After', '60');
			res.status(429).json({ error: 'Too many requests. Please try again later.' });
			return;
		}

		next();
	};
}

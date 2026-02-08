/**
 * API Collector
 *
 * Express middleware that tracks API request timing and status codes.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AnalyticsEvent } from '../analytics-event.types';

/**
 * Callback type for analytics event emission.
 */
export type AnalyticsEmitter = (event: AnalyticsEvent) => void;

/**
 * Creates Express middleware that tracks API request metrics.
 *
 * @param emitter - Callback to emit analytics events
 * @returns Express middleware function
 */
export function createApiCollectorMiddleware(
	emitter: AnalyticsEmitter,
): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction): void => {
		const start = Date.now();

		// Hook into response finish
		res.on('finish', () => {
			const duration = Date.now() - start;

			const event: AnalyticsEvent = {
				id: randomUUID(),
				category: 'api',
				name: 'api_request',
				timestamp: new Date().toISOString(),
				properties: {
					method: req.method,
					path: req.path,
					route: req.route?.path,
				},
				context: {
					source: 'server',
					duration,
					statusCode: res.statusCode,
				},
			};

			emitter(event);
		});

		next();
	};
}

/**
 * HTTP Request Metrics Middleware
 *
 * Express middleware that records HTTP request metrics using both
 * the OpenTelemetry Metrics API and the internal MetricsStore.
 */

import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import type { Meter } from '@opentelemetry/api';
import type { MetricsStore } from './metrics-store';
import { createRequestInstruments, type OtelInstruments } from './otel-helpers';

interface RequestMetricsOptions {
	store: MetricsStore;
	/** OTel Meter instance (optional — when provided, records OTel instruments) */
	meter?: Meter | null;
}

/**
 * Creates Express middleware that records HTTP request metrics.
 */
export function createRequestMetricsMiddleware(options: RequestMetricsOptions): Router {
	const { store } = options;

	let instruments: OtelInstruments | null = null;

	if (options.meter) {
		instruments = createRequestInstruments(options.meter);
	}

	const router = createRouter();

	router.use((req: Request, res: Response, next: NextFunction) => {
		const start = process.hrtime.bigint();

		store.incrementActiveRequests();
		instruments?.activeRequests.add(1);

		res.on('finish', () => {
			const durationNs = Number(process.hrtime.bigint() - start);
			const durationMs = durationNs / 1_000_000;
			const durationSec = durationNs / 1_000_000_000;

			const method = req.method;
			const statusCode = res.statusCode;
			const route = req.route?.path ?? req.path;

			const attrs = {
				method,
				route,
				status_code: String(statusCode),
			};
			instruments?.requestDuration.record(durationSec, attrs);
			instruments?.requestTotal.add(1, attrs);
			instruments?.activeRequests.add(-1);

			store.decrementActiveRequests();
			store.recordHttpRequest(method, statusCode, durationMs);
		});

		next();
	});

	return router;
}

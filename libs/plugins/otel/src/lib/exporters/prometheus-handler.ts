/**
 * Prometheus Scrape Endpoint
 *
 * Express Router that exposes metrics in Prometheus text exposition format.
 * Uses @opentelemetry/exporter-prometheus in manual mode (no standalone server).
 */

import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';

interface PrometheusHandlerOptions {
	/** The PrometheusExporter instance (from @opentelemetry/exporter-prometheus) */
	exporter: unknown;
}

/**
 * Checks if the exporter has a `getMetricsRequestHandler` method
 * that can be called with (req, res) to serve Prometheus metrics.
 */
function hasMetricsHandler(
	exporter: unknown,
): exporter is { getMetricsRequestHandler: (req: Request, res: Response) => void } {
	if (exporter == null || typeof exporter !== 'object') return false;
	if (!('getMetricsRequestHandler' in exporter)) return false;
	return typeof exporter['getMetricsRequestHandler'] === 'function';
}

/**
 * Creates an Express Router that serves the Prometheus scrape endpoint.
 *
 * The endpoint is intentionally unauthenticated — Prometheus scrapers
 * typically don't carry auth tokens, and metrics data is operational
 * (not sensitive user data).
 */
export function createPrometheusHandler(options: PrometheusHandlerOptions): Router {
	const router = createRouter();

	const exporter = options.exporter;
	const canServe = hasMetricsHandler(exporter);

	router.get('/', (req: Request, res: Response) => {
		if (canServe) {
			exporter.getMetricsRequestHandler(req, res);
		} else {
			res.status(503).send('Prometheus exporter not available');
		}
	});

	return router;
}

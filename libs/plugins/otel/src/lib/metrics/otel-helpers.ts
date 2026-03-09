/**
 * Shared OTel helpers.
 *
 * Uses the @opentelemetry/api types (already a required peer dep)
 * to provide properly typed instrument creation without type assertions.
 */

import type { Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

export interface OtelInstruments {
	requestDuration: Histogram;
	requestTotal: Counter;
	activeRequests: UpDownCounter;
}

export interface CollectionInstruments {
	operationTotal: Counter;
	operationDuration: Histogram;
}

/**
 * Creates HTTP request instruments from a Meter.
 */
export function createRequestInstruments(meter: Meter): OtelInstruments {
	return {
		requestDuration: meter.createHistogram('http.server.request.duration', {
			description: 'HTTP request duration in seconds',
			unit: 's',
		}),
		requestTotal: meter.createCounter('http.server.request.total', {
			description: 'Total HTTP requests',
		}),
		activeRequests: meter.createUpDownCounter('http.server.active_requests', {
			description: 'Number of active HTTP requests',
		}),
	};
}

/**
 * Creates collection operation instruments from a Meter.
 */
export function createCollectionInstruments(meter: Meter): CollectionInstruments {
	return {
		operationTotal: meter.createCounter('momentum.collection.operation.total', {
			description: 'Total collection operations',
		}),
		operationDuration: meter.createHistogram('momentum.collection.operation.duration', {
			description: 'Collection operation duration in seconds',
			unit: 's',
		}),
	};
}

/**
 * Tries to load the OTel SDK and Prometheus exporter.
 * Returns null if the packages are not installed.
 */
export function tryLoadOtelSdk(
	serviceName: string,
): { meter: Meter; provider: { shutdown: () => Promise<void> }; exporter: unknown } | null {
	try {
		const sdkMetrics = require('@opentelemetry/sdk-metrics');
		const promExporter = require('@opentelemetry/exporter-prometheus');

		const exporter = new promExporter.PrometheusExporter({
			preventServerStart: true,
		});

		const provider = new sdkMetrics.MeterProvider({
			readers: [exporter],
		});

		return {
			meter: provider.getMeter(serviceName),
			provider,
			exporter,
		};
	} catch {
		return null;
	}
}

/**
 * Reads span context from a doc's __otelSpan property.
 */
export function getSpanContext(
	doc: Record<string, unknown>,
): { traceId: string; spanId: string } | null {
	const span = doc['__otelSpan'];
	if (span == null || typeof span !== 'object') return null;

	if (!('spanContext' in span)) return null;
	const spanContextFn = span['spanContext'];
	if (typeof spanContextFn !== 'function') return null;

	const ctx: unknown = spanContextFn.call(span);
	if (ctx == null || typeof ctx !== 'object') return null;

	if (!('traceId' in ctx) || !('spanId' in ctx)) return null;
	const traceId = typeof ctx['traceId'] === 'string' ? ctx['traceId'] : '';
	const spanId = typeof ctx['spanId'] === 'string' ? ctx['spanId'] : '';

	return { traceId, spanId };
}

/**
 * OpenTelemetry Tracing Plugin
 *
 * Injects tracing spans into collection hooks and optionally
 * enriches log entries with trace/span IDs.
 *
 * Requires @opentelemetry/api as a peer dependency.
 * The user is responsible for setting up the OTel SDK (exporters, etc.).
 * This plugin only creates spans using the OTel API.
 *
 * @example
 * ```typescript
 * import { otelPlugin } from '@momentum-cms/plugin-otel';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     otelPlugin({ serviceName: 'my-cms' }),
 *   ],
 * });
 * ```
 */

import { trace, type Span, type Tracer, SpanStatusCode } from '@opentelemetry/api';
import type { MomentumPlugin, PluginContext } from '@momentum-cms/plugins';
import { MomentumLogger, type LogEnricher } from '@momentum-cms/logger';
import type { HookFunction, CollectionConfig } from '@momentum-cms/core';
import type { OtelPluginConfig } from './otel-plugin.types';

/**
 * Log enricher that adds trace/span IDs to log entries.
 */
class OtelLogEnricher implements LogEnricher {
	enrich(): Record<string, unknown> {
		const span = trace.getActiveSpan();
		if (!span) {
			return {};
		}

		const spanContext = span.spanContext();
		return {
			traceId: spanContext.traceId,
			spanId: spanContext.spanId,
		};
	}
}

/**
 * Creates an OpenTelemetry tracing plugin.
 *
 * @param config - Plugin configuration
 * @returns MomentumPlugin instance
 */
export function otelPlugin(config: OtelPluginConfig = {}): MomentumPlugin {
	const { serviceName = 'momentum-cms', enrichLogs = true, attributes = {}, operations } = config;

	let tracer: Tracer;
	let enricher: OtelLogEnricher | null = null;

	return {
		name: 'otel',

		onInit({ collections, logger }: PluginContext) {
			tracer = trace.getTracer(serviceName);
			logger.info(`OpenTelemetry tracing enabled (service: ${serviceName})`);

			// Register log enricher
			if (enrichLogs) {
				enricher = new OtelLogEnricher();
				MomentumLogger.registerEnricher(enricher);
				logger.info('Log enricher registered for trace/span IDs');
			}

			// Inject tracing hooks into collections
			for (const collection of collections) {
				injectTracingHooks(collection, tracer, attributes, operations);
			}

			logger.info(`Tracing hooks injected into ${collections.length} collections`);
		},

		onShutdown({ logger }: PluginContext) {
			if (enricher) {
				MomentumLogger.removeEnricher(enricher);
				enricher = null;
			}
			logger.info('OpenTelemetry plugin shut down');
		},
	};
}

/**
 * Inject before/after hooks that create OTel spans for collection operations.
 */
function injectTracingHooks(
	collection: CollectionConfig,
	tracer: Tracer,
	attributes: Record<string, string>,
	operationFilter?: string[],
): void {
	collection.hooks = collection.hooks ?? {};

	// beforeChange: start span
	const beforeChangeHook: HookFunction = (args) => {
		const operation = args.operation ?? 'create';

		if (operationFilter && !operationFilter.includes(operation)) {
			return args.data;
		}

		const span = tracer.startSpan(`${collection.slug}.${operation}`, {
			attributes: {
				'momentum.collection': collection.slug,
				'momentum.operation': operation,
				...attributes,
			},
		});

		// Store span in data for afterChange to end it
		if (args.data) {
			args.data['__otelSpan'] = span;
		}

		return args.data;
	};

	// afterChange: end span
	const afterChangeHook: HookFunction = (args) => {
		const doc = args.doc ?? args.data ?? {};
		const span = doc['__otelSpan'];

		if (span && typeof span === 'object' && 'end' in span) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by runtime checks above
			const typedSpan = span as Span;
			typedSpan.setStatus({ code: SpanStatusCode.OK });
			typedSpan.end();
		}

		// Clean up the span reference
		if (args.doc) {
			delete args.doc['__otelSpan'];
		}
	};

	// beforeDelete: start span
	const beforeDeleteHook: HookFunction = (args) => {
		if (operationFilter && !operationFilter.includes('delete')) {
			return;
		}

		const span = tracer.startSpan(`${collection.slug}.delete`, {
			attributes: {
				'momentum.collection': collection.slug,
				'momentum.operation': 'delete',
				'momentum.documentId': args.doc?.['id'] ? String(args.doc['id']) : 'unknown',
				...attributes,
			},
		});

		if (args.doc) {
			args.doc['__otelSpan'] = span;
		}
	};

	// afterDelete: end span
	const afterDeleteHook: HookFunction = (args) => {
		const doc = args.doc ?? {};
		const span = doc['__otelSpan'];

		if (span && typeof span === 'object' && 'end' in span) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by runtime checks above
			const typedSpan = span as Span;
			typedSpan.setStatus({ code: SpanStatusCode.OK });
			typedSpan.end();
		}
	};

	const existingBeforeChange = collection.hooks.beforeChange ?? [];
	collection.hooks.beforeChange = [beforeChangeHook, ...existingBeforeChange];

	const existingAfterChange = collection.hooks.afterChange ?? [];
	collection.hooks.afterChange = [...existingAfterChange, afterChangeHook];

	const existingBeforeDelete = collection.hooks.beforeDelete ?? [];
	collection.hooks.beforeDelete = [beforeDeleteHook, ...existingBeforeDelete];

	const existingAfterDelete = collection.hooks.afterDelete ?? [];
	collection.hooks.afterDelete = [...existingAfterDelete, afterDeleteHook];
}

/**
 * OpenTelemetry Observability Plugin
 *
 * Injects tracing spans into collection hooks, optionally enriches log
 * entries with trace/span IDs, and can collect metrics exposed via a
 * Prometheus scrape endpoint and an admin dashboard.
 *
 * Requires @opentelemetry/api as a peer dependency.
 * Metrics features require @opentelemetry/sdk-metrics and optionally
 * @opentelemetry/exporter-prometheus (both optional peer deps).
 *
 * @example
 * ```typescript
 * import { otelPlugin } from '@momentumcms/plugins/otel';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     otelPlugin({
 *       serviceName: 'my-cms',
 *       metrics: { enabled: true, prometheus: true },
 *     }),
 *   ],
 * });
 * ```
 */

import { trace, type Tracer, SpanStatusCode, type Meter } from '@opentelemetry/api';
import type {
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	PluginAdminRouteDescriptor,
} from '@momentumcms/plugins/core';
import { MomentumLogger, type LogEnricher } from '@momentumcms/logger';
import type { HookFunction, CollectionConfig } from '@momentumcms/core';
import type { OtelPluginConfig } from './otel-plugin.types';
import { MetricsStore } from './metrics/metrics-store';
import { createRequestMetricsMiddleware } from './metrics/request-metrics';
import { injectCollectionMetricsHooks } from './metrics/collection-metrics';
import { tryLoadOtelSdk } from './metrics/otel-helpers';
import { createOtelQueryRouter } from './api/otel-query-handler';
import { createPrometheusHandler } from './exporters/prometheus-handler';
import { OtelSnapshotsCollection } from './metrics/otel-snapshot-collection';
import { MetricsSnapshotService, type MomentumAPILike } from './metrics/metrics-snapshot-service';

/**
 * Shape of a span-like object stored on doc['__otelSpan'].
 */
interface SpanLike {
	setStatus: (status: { code: number }) => void;
	end: () => void;
}

function isSpanLike(value: unknown): value is SpanLike {
	if (value == null || typeof value !== 'object') return false;
	if (!('end' in value) || !('setStatus' in value)) return false;
	return typeof value['end'] === 'function' && typeof value['setStatus'] === 'function';
}

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
 * Resolve admin dashboard config into admin routes.
 *
 * Uses variable-based import paths to prevent esbuild from following
 * the import at build time (same pattern as analytics plugin).
 */
function resolveAdminRoutes(dashboardConfig: boolean | undefined): PluginAdminRouteDescriptor[] {
	if (dashboardConfig === false) return [];

	const dashboardModule = './dashboard/otel-dashboard.page';
	return [
		{
			path: 'observability',
			label: 'Observability',
			icon: 'heroSignal',
			loadComponent: (): Promise<unknown> =>
				import(dashboardModule).then((m: Record<string, unknown>) => m['OtelDashboardPage']),
			group: 'Plugins',
		},
	];
}

/**
 * Gets a meter from a user-supplied MeterProvider via duck-typing.
 */
function getMeterFromProvider(provider: unknown, serviceName: string): Meter | null {
	if (provider == null || typeof provider !== 'object') return null;
	if (!('getMeter' in provider)) return null;
	const getMeterFn = provider['getMeter'];
	if (typeof getMeterFn !== 'function') return null;
	return getMeterFn.call(provider, serviceName);
}

/**
 * Creates an OpenTelemetry observability plugin.
 *
 * @param config - Plugin configuration
 * @returns MomentumPlugin instance
 */
export function otelPlugin(config: OtelPluginConfig = {}): MomentumPlugin {
	const {
		serviceName = 'momentum-cms',
		enrichLogs = true,
		attributes = {},
		operations,
		metrics: metricsConfig,
	} = config;

	const metricsEnabled = metricsConfig?.enabled ?? false;
	const prometheusEnabled = metricsConfig?.prometheus ?? metricsEnabled;
	const dashboardEnabled = metricsConfig?.adminDashboard ?? metricsEnabled;

	let tracer: Tracer;
	let enricher: OtelLogEnricher | null = null;
	let metricsStore: MetricsStore | null = null;
	let meterProviderRef: { shutdown: () => Promise<void> } | null = null;
	let snapshotService: MetricsSnapshotService | null = null;
	let momentumApi: MomentumAPILike | null = null;

	const adminRoutes = metricsEnabled ? resolveAdminRoutes(dashboardEnabled) : [];

	return {
		name: 'otel',
		collections: metricsEnabled ? [OtelSnapshotsCollection] : [],
		adminRoutes,

		browserImports: metricsEnabled
			? {
					adminRoutes: {
						path: '@momentumcms/plugins-otel/admin-routes',
						exportName: 'otelAdminRoutes',
					},
				}
			: undefined,

		onInit({ collections, logger, registerMiddleware }: PluginContext) {
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

			// Metrics setup
			if (metricsEnabled) {
				metricsStore = new MetricsStore();

				// Register snapshot collection for persistence
				collections.push(OtelSnapshotsCollection);

				// Create snapshot service
				snapshotService = new MetricsSnapshotService({
					store: metricsStore,
					getApi: () => momentumApi,
					snapshotInterval: metricsConfig?.snapshotInterval,
					retentionDays: metricsConfig?.retentionDays,
				});

				let meter: Meter | null = null;

				if (metricsConfig?.meterProvider) {
					meter = getMeterFromProvider(metricsConfig.meterProvider, serviceName);
					logger.info('Using user-supplied MeterProvider');
				} else if (prometheusEnabled) {
					const sdk = tryLoadOtelSdk(serviceName);
					if (sdk) {
						meter = sdk.meter;
						meterProviderRef = sdk.provider;

						// Register Prometheus scrape endpoint
						const prometheusPath =
							typeof metricsConfig?.prometheus === 'object'
								? (metricsConfig.prometheus.path ?? '/metrics')
								: '/metrics';

						registerMiddleware({
							path: prometheusPath,
							handler: createPrometheusHandler({ exporter: sdk.exporter }),
							position: 'root',
						});

						logger.info(`Prometheus endpoint registered at ${prometheusPath}`);
					} else {
						logger.warn(
							'@opentelemetry/sdk-metrics or @opentelemetry/exporter-prometheus not found. ' +
								'Install them to enable Prometheus metrics. Metrics store will still work for the dashboard.',
						);
					}
				}

				// Request metrics middleware
				const requestMetrics = createRequestMetricsMiddleware({
					store: metricsStore,
					meter,
				});
				registerMiddleware({
					path: '/',
					handler: requestMetrics,
					position: 'before-api',
				});

				// Collection metrics hooks
				injectCollectionMetricsHooks(collections, {
					store: metricsStore,
					meter,
					operations: operations ?? undefined,
				});

				// OTel summary query endpoint
				if (dashboardEnabled) {
					const queryRouter = createOtelQueryRouter(
						metricsStore,
						() => momentumApi,
						snapshotService,
					);
					registerMiddleware({
						path: '/otel',
						handler: queryRouter,
						position: 'before-api',
					});
					logger.info('Observability dashboard API registered');
				}

				logger.info('Metrics collection enabled');
			}
		},

		async onReady({ logger, api }: PluginReadyContext) {
			momentumApi = api;

			if (snapshotService) {
				await snapshotService.restore();
				snapshotService.start();
				logger.info('Metrics snapshot service started');
			}
		},

		async onShutdown({ logger }: PluginContext) {
			if (snapshotService) {
				await snapshotService.shutdown();
				snapshotService = null;
			}

			if (enricher) {
				MomentumLogger.removeEnricher(enricher);
				enricher = null;
			}

			if (meterProviderRef) {
				await meterProviderRef.shutdown();
				meterProviderRef = null;
			}

			metricsStore = null;
			momentumApi = null;
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

		if (isSpanLike(span)) {
			span.setStatus({ code: SpanStatusCode.OK });
			span.end();
		}

		// Clean up the span reference
		if (args.doc) {
			delete args.doc['__otelSpan'];
		}
		if (args.data) {
			delete args.data['__otelSpan'];
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

		if (isSpanLike(span)) {
			span.setStatus({ code: SpanStatusCode.OK });
			span.end();
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

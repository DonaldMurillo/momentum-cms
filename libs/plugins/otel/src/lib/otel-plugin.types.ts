/**
 * OTel Plugin Types
 *
 * Shared types used by both server (metrics-store) and browser (dashboard service).
 */

/**
 * A recorded span for the admin dashboard.
 */
export interface SpanRecord {
	traceId: string;
	spanId: string;
	name: string;
	collection: string;
	operation: string;
	durationMs: number;
	status: 'ok' | 'error';
	timestamp: string;
}

/**
 * Collection metrics entry for the admin dashboard.
 */
export interface CollectionMetricEntry {
	collection: string;
	creates: number;
	updates: number;
	deletes: number;
	avgDurationMs: number;
}

/**
 * Full observability summary returned by the admin API.
 */
export interface OtelSummaryData {
	uptime: number;
	activeRequests: number;
	memoryUsageMb: number;
	requestMetrics: {
		totalRequests: number;
		avgDurationMs: number;
		errorCount: number;
		byMethod: Record<string, number>;
		byStatusCode: Record<string, number>;
	};
	collectionMetrics: CollectionMetricEntry[];
	recentSpans: SpanRecord[];
}

/**
 * A persisted metric snapshot (stored in the otel-snapshots collection).
 */
export interface OtelSnapshotData {
	id?: string;
	totalRequests: number;
	errorCount: number;
	avgDurationMs: number;
	memoryUsageMb: number;
	byMethod: Record<string, number>;
	byStatusCode: Record<string, number>;
	collectionMetrics: CollectionMetricEntry[];
	topSpans: SpanRecord[];
	createdAt?: string;
}

/**
 * Metrics configuration for the OpenTelemetry plugin.
 */
export interface OtelMetricsConfig {
	/** Enable metrics collection. @default false */
	enabled?: boolean;

	/** Prometheus scrape endpoint. @default true when metrics enabled */
	prometheus?: boolean | { path?: string };

	/** Custom MeterProvider instance. When omitted and prometheus is enabled, one is auto-created. */
	meterProvider?: unknown;

	/** Admin observability dashboard. @default true when metrics enabled */
	adminDashboard?: boolean;

	/** Interval between snapshot flushes in ms. @default 60000 */
	snapshotInterval?: number;

	/** Days to retain snapshots before auto-pruning. @default 7 */
	retentionDays?: number;
}

/**
 * Configuration for the OpenTelemetry plugin.
 */
export interface OtelPluginConfig {
	/** Service name for traces. @default 'momentum-cms' */
	serviceName?: string;

	/** Whether to enrich logs with trace/span IDs. @default true */
	enrichLogs?: boolean;

	/** Custom attributes to add to all spans */
	attributes?: Record<string, string>;

	/** Collection operations to trace. @default all */
	operations?: Array<'create' | 'update' | 'delete' | 'find'>;

	/** Metrics configuration */
	metrics?: OtelMetricsConfig;
}

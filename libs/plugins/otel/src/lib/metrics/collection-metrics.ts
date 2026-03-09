/**
 * Collection Operation Metrics
 *
 * Injects hooks into collections that record OTel metrics (counters, histograms)
 * and update the internal MetricsStore for each CRUD operation.
 */

import type { CollectionConfig, HookFunction } from '@momentumcms/core';
import type { Meter } from '@opentelemetry/api';
import type { MetricsStore, SpanRecord } from './metrics-store';
import { createCollectionInstruments, getSpanContext, type CollectionInstruments } from './otel-helpers';

interface CollectionMetricsOptions {
	store: MetricsStore;
	/** OTel Meter instance (optional) */
	meter?: Meter | null;
	/** Filter to specific operations */
	operations?: string[];
}

const EXCLUDED_COLLECTIONS = new Set(['otel-snapshots']);
const TRACKED_OPERATIONS = new Set(['create', 'update', 'delete']);

function isTrackedOperation(op: string): op is 'create' | 'update' | 'delete' {
	return TRACKED_OPERATIONS.has(op);
}

function calcDurationMs(startTime: unknown): number {
	if (typeof startTime === 'bigint') {
		return Number(process.hrtime.bigint() - startTime) / 1_000_000;
	}
	return 0;
}

function buildSpanRecord(
	doc: Record<string, unknown>,
	slug: string,
	operation: string,
	durationMs: number,
): SpanRecord {
	const spanCtx = getSpanContext(doc);
	return {
		traceId: spanCtx?.traceId ?? '',
		spanId: spanCtx?.spanId ?? '',
		name: `${slug}.${operation}`,
		collection: slug,
		operation,
		durationMs: Math.round(durationMs),
		status: 'ok',
		timestamp: new Date().toISOString(),
	};
}

/**
 * Injects collection hooks that record operation metrics.
 */
export function injectCollectionMetricsHooks(
	collections: CollectionConfig[],
	options: CollectionMetricsOptions,
): void {
	const { store } = options;

	let instruments: CollectionInstruments | null = null;

	if (options.meter) {
		instruments = createCollectionInstruments(options.meter);
	}

	for (const collection of collections) {
		if (EXCLUDED_COLLECTIONS.has(collection.slug)) continue;

		collection.hooks = collection.hooks ?? {};

		// beforeChange: record start time
		const beforeChangeHook: HookFunction = (args) => {
			const operation = args.operation ?? 'create';
			if (options.operations && !options.operations.includes(operation)) {
				return args.data;
			}
			if (args.data) {
				args.data['__metricsStart'] = process.hrtime.bigint();
			}
			return args.data;
		};

		// afterChange: record duration + counters
		const afterChangeHook: HookFunction = (args) => {
			const doc = args.doc ?? args.data ?? {};
			const operation = args.operation ?? 'create';

			if (options.operations && !options.operations.includes(operation)) {
				return;
			}

			const durationMs = calcDurationMs(doc['__metricsStart']);
			const attrs = { collection: collection.slug, operation };

			instruments?.operationTotal.add(1, attrs);
			instruments?.operationDuration.record(durationMs / 1000, attrs);

			if (isTrackedOperation(operation)) {
				store.recordCollectionOperation(collection.slug, operation, durationMs);
			}

			store.recordSpan(buildSpanRecord(doc, collection.slug, operation, durationMs));

			if (args.doc) {
				delete args.doc['__metricsStart'];
			}
			if (args.data) {
				delete args.data['__metricsStart'];
			}
		};

		// beforeDelete: record start time
		const beforeDeleteHook: HookFunction = (args) => {
			if (options.operations && !options.operations.includes('delete')) {
				return;
			}
			if (args.doc) {
				args.doc['__metricsStart'] = process.hrtime.bigint();
			}
		};

		// afterDelete: record duration + counters
		const afterDeleteHook: HookFunction = (args) => {
			if (options.operations && !options.operations.includes('delete')) {
				return;
			}

			const doc = args.doc ?? {};
			const durationMs = calcDurationMs(doc['__metricsStart']);
			const attrs = { collection: collection.slug, operation: 'delete' };

			instruments?.operationTotal.add(1, attrs);
			instruments?.operationDuration.record(durationMs / 1000, attrs);

			store.recordCollectionOperation(collection.slug, 'delete', durationMs);
			store.recordSpan(buildSpanRecord(doc, collection.slug, 'delete', durationMs));
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
}

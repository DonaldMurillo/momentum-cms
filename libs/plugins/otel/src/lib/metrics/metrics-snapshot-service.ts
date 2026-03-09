/* eslint-disable local/no-direct-browser-apis -- Server-side snapshot service, not Angular-managed */

/**
 * Metrics Snapshot Service
 *
 * Periodically persists in-memory metrics to the otel-snapshots collection
 * and restores them on startup. Auto-prunes old snapshots to bound DB growth.
 */

import type { MetricsStore } from './metrics-store';
import type { OtelSnapshotData, CollectionMetricEntry, SpanRecord } from '../otel-plugin.types';
import { createLogger, type MomentumLogger } from '@momentumcms/logger';
import {
	isFindable,
	isCreatable,
	isDeletable,
	isRecord,
	type MomentumAPILike,
} from '../api/otel-api-guards';

export type { MomentumAPILike } from '../api/otel-api-guards';

export interface MetricsSnapshotServiceOptions {
	store: MetricsStore;
	getApi: () => MomentumAPILike | null;
	snapshotInterval?: number;
	retentionDays?: number;
}

export class MetricsSnapshotService {
	private readonly store: MetricsStore;
	private readonly getApi: () => MomentumAPILike | null;
	private readonly snapshotInterval: number;
	private readonly retentionDays: number;
	private readonly logger: MomentumLogger;
	private timer: ReturnType<typeof setInterval> | null = null;
	private flushing = false;

	constructor(options: MetricsSnapshotServiceOptions) {
		this.store = options.store;
		this.getApi = options.getApi;
		this.snapshotInterval = options.snapshotInterval ?? 60_000;
		this.retentionDays = options.retentionDays ?? 7;
		this.logger = createLogger('OTel-Snapshots');
	}

	start(): void {
		if (this.timer) return;

		this.timer = setInterval(() => {
			void this.flush();
		}, this.snapshotInterval);
	}

	async flush(): Promise<void> {
		if (this.flushing) return;
		this.flushing = true;

		try {
			const api = this.getApi();
			if (!api) return;

			const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
			if (!isCreatable(ops)) return;

			const snapshot = this.store.getSnapshotData();
			const data: Record<string, unknown> = {
				totalRequests: snapshot.totalRequests,
				errorCount: snapshot.errorCount,
				avgDurationMs: snapshot.avgDurationMs,
				memoryUsageMb: snapshot.memoryUsageMb,
				byMethod: snapshot.byMethod,
				byStatusCode: snapshot.byStatusCode,
				collectionMetrics: snapshot.collectionMetrics,
				topSpans: snapshot.topSpans,
			};
			await ops.create(data);

			await this.prune();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to flush snapshot: ${message}`);
		} finally {
			this.flushing = false;
		}
	}

	async restore(): Promise<void> {
		try {
			const api = this.getApi();
			if (!api) return;

			const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
			if (!isFindable(ops)) return;

			const result = await ops.find({ limit: 1, sort: '-createdAt' });
			const docs = Array.isArray(result.docs) ? result.docs : [];
			if (docs.length === 0) return;

			const doc = docs[0];
			if (!isRecord(doc)) return;

			const byMethod: Record<string, number> = {};
			const rawMethod = doc['byMethod'];
			if (isRecord(rawMethod)) {
				for (const [k, v] of Object.entries(rawMethod)) {
					if (typeof v === 'number') byMethod[k] = v;
				}
			}

			const byStatusCode: Record<string, number> = {};
			const rawStatus = doc['byStatusCode'];
			if (isRecord(rawStatus)) {
				for (const [k, v] of Object.entries(rawStatus)) {
					if (typeof v === 'number') byStatusCode[k] = v;
				}
			}

			const snapshot: OtelSnapshotData = {
				totalRequests: typeof doc['totalRequests'] === 'number' ? doc['totalRequests'] : 0,
				errorCount: typeof doc['errorCount'] === 'number' ? doc['errorCount'] : 0,
				avgDurationMs: typeof doc['avgDurationMs'] === 'number' ? doc['avgDurationMs'] : 0,
				memoryUsageMb: typeof doc['memoryUsageMb'] === 'number' ? doc['memoryUsageMb'] : 0,
				byMethod,
				byStatusCode,
				collectionMetrics: Array.isArray(doc['collectionMetrics'])
					? extractCollectionMetrics(doc['collectionMetrics'])
					: [],
				topSpans: Array.isArray(doc['topSpans'])
					? extractSpanRecords(doc['topSpans'])
					: [],
			};

			this.store.restore(snapshot);
			this.logger.info('Metrics restored from last snapshot');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Failed to restore snapshot: ${message}`);
		}
	}

	async shutdown(): Promise<void> {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		await this.flush();
	}

	async purgeAll(): Promise<number> {
		const api = this.getApi();
		if (!api) return 0;

		const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
		if (!isFindable(ops) || !isDeletable(ops)) return 0;

		let deleted = 0;
		const MAX_BATCHES = 100;

		for (let batch = 0; batch < MAX_BATCHES; batch++) {
			const result = await ops.find({ limit: 50 });
			const docs = Array.isArray(result.docs) ? result.docs : [];
			if (docs.length === 0) break;

			let batchDeleted = 0;
			for (const doc of docs) {
				if (isRecord(doc) && typeof doc['id'] === 'string') {
					await ops.delete(doc['id']);
					deleted++;
					batchDeleted++;
				}
			}

			// If no docs were deletable in this batch, stop to avoid infinite loop
			if (batchDeleted === 0) break;
		}

		this.logger.info(`Purged ${deleted} snapshots`);
		return deleted;
	}

	private async prune(): Promise<void> {
		const api = this.getApi();
		if (!api) return;

		const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
		if (!isFindable(ops) || !isDeletable(ops)) return;

		const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000).toISOString();

		try {
			const result = await ops.find({
				where: { createdAt: { lt: cutoff } },
				limit: 100,
			});

			const docs = Array.isArray(result.docs) ? result.docs : [];
			for (const doc of docs) {
				if (isRecord(doc) && typeof doc['id'] === 'string') {
					await ops.delete(doc['id']);
				}
			}

			if (docs.length > 0) {
				this.logger.info(`Pruned ${docs.length} expired snapshots`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Failed to prune snapshots: ${message}`);
		}
	}
}

function extractCollectionMetrics(raw: unknown[]): CollectionMetricEntry[] {
	const result: CollectionMetricEntry[] = [];
	for (const item of raw) {
		if (!isRecord(item)) continue;
		result.push({
			collection: typeof item['collection'] === 'string' ? item['collection'] : '',
			creates: typeof item['creates'] === 'number' ? item['creates'] : 0,
			updates: typeof item['updates'] === 'number' ? item['updates'] : 0,
			deletes: typeof item['deletes'] === 'number' ? item['deletes'] : 0,
			avgDurationMs: typeof item['avgDurationMs'] === 'number' ? item['avgDurationMs'] : 0,
		});
	}
	return result;
}

function extractSpanRecords(raw: unknown[]): SpanRecord[] {
	const result: SpanRecord[] = [];
	for (const item of raw) {
		if (!isRecord(item)) continue;
		result.push({
			traceId: typeof item['traceId'] === 'string' ? item['traceId'] : '',
			spanId: typeof item['spanId'] === 'string' ? item['spanId'] : '',
			name: typeof item['name'] === 'string' ? item['name'] : '',
			collection: typeof item['collection'] === 'string' ? item['collection'] : '',
			operation: typeof item['operation'] === 'string' ? item['operation'] : '',
			durationMs: typeof item['durationMs'] === 'number' ? item['durationMs'] : 0,
			status: item['status'] === 'error' ? 'error' : 'ok',
			timestamp: typeof item['timestamp'] === 'string' ? item['timestamp'] : '',
		});
	}
	return result;
}

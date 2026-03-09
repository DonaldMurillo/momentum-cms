/**
 * In-memory metrics store for the admin dashboard API.
 *
 * Maintains rolling counters and a circular buffer of recent spans
 * so the `/api/otel/summary` endpoint can return a JSON snapshot
 * without directly depending on the OTel SDK.
 */

import type { SpanRecord, OtelSummaryData, OtelSnapshotData, CollectionMetricEntry } from '../otel-plugin.types';

// Re-export shared types for consumers that import from this file
export type { SpanRecord, OtelSummaryData, OtelSnapshotData } from '../otel-plugin.types';

interface InternalCollectionMetrics {
	creates: number;
	updates: number;
	deletes: number;
	totalDurationMs: number;
	operationCount: number;
}

export class MetricsStore {
	private readonly startTime = Date.now();
	private readonly maxSpans: number;
	private readonly recentSpans: SpanRecord[] = [];
	private readonly collectionMetrics = new Map<string, InternalCollectionMetrics>();
	private activeRequests = 0;

	// HTTP request metrics
	private totalRequests = 0;
	private totalDurationMs = 0;
	private errorCount = 0;
	private readonly byMethod = new Map<string, number>();
	private readonly byStatusCode = new Map<string, number>();

	constructor(maxSpans = 100) {
		this.maxSpans = maxSpans;
	}

	recordSpan(span: SpanRecord): void {
		this.recentSpans.push(span);
		if (this.recentSpans.length > this.maxSpans) {
			this.recentSpans.shift();
		}
	}

	recordCollectionOperation(
		collection: string,
		operation: 'create' | 'update' | 'delete',
		durationMs: number,
	): void {
		let entry = this.collectionMetrics.get(collection);
		if (!entry) {
			entry = { creates: 0, updates: 0, deletes: 0, totalDurationMs: 0, operationCount: 0 };
			this.collectionMetrics.set(collection, entry);
		}

		if (operation === 'create') entry.creates++;
		else if (operation === 'update') entry.updates++;
		else if (operation === 'delete') entry.deletes++;

		entry.totalDurationMs += durationMs;
		entry.operationCount++;
	}

	recordHttpRequest(method: string, statusCode: number, durationMs: number): void {
		this.totalRequests++;
		this.totalDurationMs += durationMs;
		if (statusCode >= 400) this.errorCount++;

		const methodUpper = method.toUpperCase();
		this.byMethod.set(methodUpper, (this.byMethod.get(methodUpper) ?? 0) + 1);

		const statusKey = String(statusCode);
		this.byStatusCode.set(statusKey, (this.byStatusCode.get(statusKey) ?? 0) + 1);
	}

	incrementActiveRequests(): void {
		this.activeRequests++;
	}

	decrementActiveRequests(): void {
		this.activeRequests = Math.max(0, this.activeRequests - 1);
	}

	getSnapshotData(): OtelSnapshotData {
		const collectionMetrics = this.buildCollectionMetrics();

		// Top 5 slowest spans from the recent buffer
		const topSpans = [...this.recentSpans]
			.sort((a, b) => b.durationMs - a.durationMs)
			.slice(0, 5);

		return {
			totalRequests: this.totalRequests,
			errorCount: this.errorCount,
			avgDurationMs:
				this.totalRequests > 0
					? Math.round(this.totalDurationMs / this.totalRequests)
					: 0,
			memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
			byMethod: Object.fromEntries(this.byMethod),
			byStatusCode: Object.fromEntries(this.byStatusCode),
			collectionMetrics,
			topSpans,
		};
	}

	restore(snapshot: OtelSnapshotData): void {
		this.totalRequests = snapshot.totalRequests;
		this.errorCount = snapshot.errorCount;
		// Reconstruct totalDurationMs from avgDurationMs * totalRequests
		this.totalDurationMs = snapshot.avgDurationMs * snapshot.totalRequests;

		this.byMethod.clear();
		for (const [method, count] of Object.entries(snapshot.byMethod)) {
			this.byMethod.set(method, count);
		}

		this.byStatusCode.clear();
		for (const [status, count] of Object.entries(snapshot.byStatusCode)) {
			this.byStatusCode.set(status, count);
		}

		this.collectionMetrics.clear();
		for (const cm of snapshot.collectionMetrics) {
			const totalOps = cm.creates + cm.updates + cm.deletes;
			this.collectionMetrics.set(cm.collection, {
				creates: cm.creates,
				updates: cm.updates,
				deletes: cm.deletes,
				totalDurationMs: cm.avgDurationMs * totalOps,
				operationCount: totalOps,
			});
		}
		// recentSpans and activeRequests are NOT restored — ephemeral by nature
	}

	private buildCollectionMetrics(): CollectionMetricEntry[] {
		return Array.from(this.collectionMetrics.entries()).map(
			([collection, entry]) => ({
				collection,
				creates: entry.creates,
				updates: entry.updates,
				deletes: entry.deletes,
				avgDurationMs:
					entry.operationCount > 0
						? Math.round(entry.totalDurationMs / entry.operationCount)
						: 0,
			}),
		);
	}

	getSummary(): OtelSummaryData {
		const collectionMetrics = this.buildCollectionMetrics();

		return {
			uptime: Math.round((Date.now() - this.startTime) / 1000),
			activeRequests: this.activeRequests,
			memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
			requestMetrics: {
				totalRequests: this.totalRequests,
				avgDurationMs:
					this.totalRequests > 0
						? Math.round(this.totalDurationMs / this.totalRequests)
						: 0,
				errorCount: this.errorCount,
				byMethod: Object.fromEntries(this.byMethod),
				byStatusCode: Object.fromEntries(this.byStatusCode),
			},
			collectionMetrics,
			recentSpans: [...this.recentSpans].reverse(),
		};
	}
}

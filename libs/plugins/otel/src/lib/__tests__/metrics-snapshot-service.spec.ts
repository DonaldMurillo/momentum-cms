import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsSnapshotService } from '../metrics/metrics-snapshot-service';
import { MetricsStore } from '../metrics/metrics-store';
import type { MomentumAPILike } from '../api/otel-api-guards';

function createMockApi(docs: Record<string, unknown>[] = []) {
	const deletedIds = new Set<string>();

	const ops = {
		find: vi.fn().mockImplementation(() =>
			Promise.resolve({
				docs: docs.filter((d) => !deletedIds.has(d['id'] as string)),
			}),
		),
		create: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockImplementation((id: string) => {
			deletedIds.add(id);
			return Promise.resolve({});
		}),
	};

	const api: MomentumAPILike = {
		collection: vi.fn().mockReturnValue(ops),
		setContext: vi.fn().mockReturnThis(),
	};

	return { api, ops, deletedIds };
}

describe('MetricsSnapshotService', () => {
	let store: MetricsStore;

	beforeEach(() => {
		store = new MetricsStore();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('purgeAll', () => {
		it('should cap iterations via MAX_BATCHES when docs persist after deletion', async () => {
			// find always returns the same docs — simulates deletes that don't stick
			const stubbornDocs = Array.from({ length: 5 }, (_, i) => ({
				id: `doc-${i}`,
				totalRequests: 100,
			}));

			const ops = {
				find: vi.fn().mockResolvedValue({ docs: stubbornDocs }),
				delete: vi.fn().mockResolvedValue({}),
			};

			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue(ops),
				setContext: vi.fn().mockReturnThis(),
			};

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			const result = await service.purgeAll();

			// MAX_BATCHES = 100 → exactly 100 find calls, 500 delete calls
			expect(ops.find).toHaveBeenCalledTimes(100);
			expect(ops.delete).toHaveBeenCalledTimes(500);
			expect(result).toBe(500);
		});

		it('should exit early when docs have no deletable id (batchDeleted === 0 guard)', async () => {
			// Docs without an `id` field can't be deleted — triggers the early exit
			const undeletableDocs = [
				{ totalRequests: 10 },
				{ totalRequests: 20 },
			];

			const ops = {
				find: vi.fn().mockResolvedValue({ docs: undeletableDocs }),
				delete: vi.fn().mockResolvedValue({}),
			};

			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue(ops),
				setContext: vi.fn().mockReturnThis(),
			};

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			const result = await service.purgeAll();

			// Should exit after first batch since batchDeleted === 0
			expect(ops.find).toHaveBeenCalledTimes(1);
			expect(ops.delete).not.toHaveBeenCalled();
			expect(result).toBe(0);
		});

		it('should delete all documents when deletes succeed normally', async () => {
			const { api, ops: _ops, deletedIds } = createMockApi([
				{ id: 'snap-1', totalRequests: 10 },
				{ id: 'snap-2', totalRequests: 20 },
				{ id: 'snap-3', totalRequests: 30 },
			]);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			const result = await service.purgeAll();

			expect(result).toBe(3);
			expect(deletedIds.size).toBe(3);
			expect(api.setContext).toHaveBeenCalledWith({ overrideAccess: true });
			expect(api.collection).toHaveBeenCalledWith('otel-snapshots');
		});

		it('should propagate delete errors to the caller', async () => {
			const ops = {
				find: vi.fn().mockResolvedValue({ docs: [{ id: 'snap-1', totalRequests: 10 }] }),
				delete: vi.fn().mockRejectedValue(new Error('DB connection lost')),
			};

			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue(ops),
				setContext: vi.fn().mockReturnThis(),
			};

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			await expect(service.purgeAll()).rejects.toThrow('DB connection lost');
		});

		it('should return 0 when collection ops lack find or delete', async () => {
			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue({}),
				setContext: vi.fn().mockReturnThis(),
			};

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			const result = await service.purgeAll();

			expect(result).toBe(0);
		});

		it('should return 0 when no documents exist', async () => {
			const { api } = createMockApi([]);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			const result = await service.purgeAll();

			expect(result).toBe(0);
		});

		it('should return 0 when API is unavailable', async () => {
			const service = new MetricsSnapshotService({
				store,
				getApi: () => null,
			});

			const result = await service.purgeAll();

			expect(result).toBe(0);
		});
	});

	describe('flush + prune', () => {
		it('should persist a snapshot and prune expired ones using the lt operator', async () => {
			const { api, ops } = createMockApi([]);

			store.recordHttpRequest('GET', 200, 42);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
				retentionDays: 7,
			});

			await service.flush();

			// flush should create a snapshot
			expect(ops.create).toHaveBeenCalledTimes(1);
			const createdData = ops.create.mock.calls[0][0] as Record<string, unknown>;
			expect(createdData['totalRequests']).toBe(1);
			expect(createdData['avgDurationMs']).toBe(42);

			// prune should use the correct `lt` operator for time-based filtering
			const findCalls = ops.find.mock.calls;
			const pruneFindCall = findCalls.find(
				(call: unknown[]) => {
					const arg = call[0] as Record<string, unknown>;
					return arg['where'] != null;
				},
			);
			expect(pruneFindCall).toBeDefined();
			if (!pruneFindCall?.[0]) throw new Error('Prune find call not found');
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test assertion casting
			const pruneWhere = (pruneFindCall[0] as Record<string, unknown>)['where'] as Record<string, unknown>;
			const createdAtFilter = pruneWhere['createdAt'] as Record<string, unknown>;

			// Must use `lt`, NOT `less_than`
			expect(createdAtFilter).toHaveProperty('lt');
			expect(createdAtFilter).not.toHaveProperty('less_than');
			expect(typeof createdAtFilter['lt']).toBe('string');
		});

		it('should guard against concurrent flushes', async () => {
			const { api, ops } = createMockApi([]);

			// Make create slow so we can trigger concurrent calls
			ops.create.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 50)),
			);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			// Fire two flushes concurrently — second should be skipped
			const [r1, r2] = await Promise.all([service.flush(), service.flush()]);

			expect(r1).toBeUndefined();
			expect(r2).toBeUndefined();
			expect(ops.create).toHaveBeenCalledTimes(1);
		});
	});

	describe('restore', () => {
		it('should restore metrics from the most recent snapshot', async () => {
			const snapshotDoc = {
				id: 'snap-latest',
				totalRequests: 500,
				errorCount: 12,
				avgDurationMs: 35,
				memoryUsageMb: 128,
				byMethod: { GET: 400, POST: 100 },
				byStatusCode: { '200': 450, '500': 12, '404': 38 },
				collectionMetrics: [
					{ collection: 'posts', creates: 10, updates: 5, deletes: 2, avgDurationMs: 20 },
				],
				topSpans: [
					{
						traceId: 'abc123',
						spanId: 'span1',
						name: 'posts.create',
						collection: 'posts',
						operation: 'create',
						durationMs: 45,
						status: 'ok',
						timestamp: '2026-03-09T00:00:00.000Z',
					},
				],
				createdAt: '2026-03-09T12:00:00.000Z',
			};

			const { api } = createMockApi([snapshotDoc]);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
			});

			await service.restore();

			// Verify the store was hydrated from the snapshot
			const summary = store.getSummary();
			expect(summary.requestMetrics.totalRequests).toBe(500);
			expect(summary.requestMetrics.errorCount).toBe(12);
			expect(summary.requestMetrics.byMethod).toEqual({ GET: 400, POST: 100 });
			expect(summary.requestMetrics.byStatusCode).toEqual({ '200': 450, '500': 12, '404': 38 });
			expect(summary.collectionMetrics).toHaveLength(1);
			expect(summary.collectionMetrics[0].collection).toBe('posts');
			expect(summary.collectionMetrics[0].creates).toBe(10);
		});

		it('should silently handle missing API', async () => {
			const service = new MetricsSnapshotService({
				store,
				getApi: () => null,
			});

			// Should not throw
			await service.restore();

			const summary = store.getSummary();
			expect(summary.requestMetrics.totalRequests).toBe(0);
		});
	});

	describe('shutdown', () => {
		it('should clear the timer and flush one final time', async () => {
			const { api, ops } = createMockApi([]);

			store.recordHttpRequest('POST', 201, 100);

			const service = new MetricsSnapshotService({
				store,
				getApi: () => api,
				snapshotInterval: 60_000,
			});

			service.start();
			await service.shutdown();

			// Final flush should have persisted
			expect(ops.create).toHaveBeenCalledTimes(1);
		});
	});
});

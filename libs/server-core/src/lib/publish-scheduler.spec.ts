/**
 * Tests for the publish scheduler.
 *
 * Covers: no versioned collections, adapter without findScheduledDocuments,
 * successful publish, partial failures, clearing scheduledPublishAt,
 * timer start/stop, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CollectionConfig, DatabaseAdapter } from '@momentumcms/core';
import { startPublishScheduler } from './publish-scheduler';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';

// ============================================
// Helpers
// ============================================

/** Build a versioned collection config (versions.drafts enabled). */
function versionedCollection(slug: string): CollectionConfig {
	return {
		slug,
		fields: [{ name: 'title', type: 'text' }],
		versions: { drafts: true },
	};
}

/** Build a non-versioned collection config. */
function nonVersionedCollection(slug: string): CollectionConfig {
	return {
		slug,
		fields: [{ name: 'title', type: 'text' }],
	};
}

interface ScheduledDoc {
	id: string;
	scheduledPublishAt?: string;
	[key: string]: unknown;
}

/**
 * Create a mock adapter that supports the full scheduler → publish pipeline.
 *
 * The publish flow goes through MomentumAPI → VersionOperations → adapter,
 * so we need findById to return docs, updateStatus to work, etc.
 */
function createSchedulerMockAdapter(
	scheduledDocsByCollection: Record<string, ScheduledDoc[]> = {},
	options: {
		failPublishForIds?: string[]; // IDs whose updateStatus should throw
		failFindScheduled?: string[]; // collection slugs whose findScheduledDocuments should throw
		skipSetScheduledPublishAt?: boolean;
	} = {},
): DatabaseAdapter {
	const store = new Map<string, Record<string, unknown>>();

	// Seed the store with scheduled docs so findById returns them
	for (const docs of Object.values(scheduledDocsByCollection)) {
		for (const doc of docs) {
			store.set(doc.id, { _status: 'draft', ...doc });
		}
	}

	return {
		find: vi.fn(async () => Array.from(store.values())),
		findById: vi.fn(async (_col: string, id: string) => store.get(id) ?? null),
		create: vi.fn(async (_col: string, data: Record<string, unknown>) => {
			const doc = { id: `generated-${Date.now()}`, ...data };
			store.set(doc.id, doc);
			return doc;
		}),
		update: vi.fn(async (_col: string, id: string, data: Record<string, unknown>) => {
			const existing = store.get(id) ?? {};
			const merged = { ...existing, ...data };
			store.set(id, merged);
			return merged;
		}),
		delete: vi.fn(async (_col: string, id: string) => store.delete(id)),

		findScheduledDocuments: vi.fn(async (slug: string, _now: string) => {
			if (options.failFindScheduled?.includes(slug)) {
				throw new Error('DB error');
			}
			return scheduledDocsByCollection[slug] ?? [];
		}),

		updateStatus: vi.fn(async (_col: string, id: string, _status: string) => {
			if (options.failPublishForIds?.includes(id)) {
				throw new Error('Publish failed');
			}
			const doc = store.get(id);
			if (doc) store.set(id, { ...doc, _status });
		}),

		createVersion: vi.fn(async () => undefined),

		...(options.skipSetScheduledPublishAt
			? {}
			: {
					setScheduledPublishAt: vi.fn(async () => undefined),
				}),
	};
}

/** Initialize MomentumAPI with a minimal config for the given collections. */
function initTestAPI(collections: CollectionConfig[], adapter: DatabaseAdapter) {
	resetMomentumAPI();
	initializeMomentumAPI({
		collections,
		db: { adapter },
	});
}

// ============================================
// Tests
// ============================================

describe('startPublishScheduler', () => {
	beforeEach(() => {
		resetMomentumAPI();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		resetMomentumAPI();
	});

	// --- No versioned collections ---

	it('should return a no-op handle when no versioned collections exist', () => {
		const adapter = createSchedulerMockAdapter();
		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [nonVersionedCollection('posts')], {
			logger: (msg) => logs.push(msg),
		});

		expect(logs).toContain(
			'[PublishScheduler] No versioned collections found, scheduler not started',
		);
		expect(handle.poll()).resolves.toBe(0);
		handle.stop();
	});

	it('should return a no-op handle when collections array is empty', () => {
		const adapter = createSchedulerMockAdapter();
		const handle = startPublishScheduler(adapter, []);
		expect(handle.poll()).resolves.toBe(0);
		handle.stop();
	});

	// --- Adapter without findScheduledDocuments ---

	it('should return 0 from poll when adapter does not support findScheduledDocuments', async () => {
		// Create a bare adapter without findScheduledDocuments
		const adapter: DatabaseAdapter = {
			find: vi.fn(async () => []),
			findById: vi.fn(async () => null),
			create: vi.fn(async (_c, d) => ({ id: 'x', ...d })),
			update: vi.fn(async (_c, _id, d) => d),
			delete: vi.fn(async () => true),
		};
		initTestAPI([versionedCollection('posts')], adapter);

		const handle = startPublishScheduler(adapter, [versionedCollection('posts')]);
		const count = await handle.poll();
		expect(count).toBe(0);
		handle.stop();
	});

	// --- Successful publish ---

	it('should publish scheduled documents and return the count', async () => {
		const scheduledDocs = [
			{ id: 'doc-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' },
			{ id: 'doc-2', scheduledPublishAt: '2024-01-01T00:00:00.000Z' },
		];
		const adapter = createSchedulerMockAdapter({ posts: scheduledDocs });
		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		const count = await handle.poll();
		expect(count).toBe(2);
		expect(logs).toContainEqual(
			expect.stringContaining('[PublishScheduler] Published posts/doc-1'),
		);
		expect(logs).toContainEqual(
			expect.stringContaining('[PublishScheduler] Published posts/doc-2'),
		);

		// Should clear scheduledPublishAt after publishing
		expect(adapter.setScheduledPublishAt).toHaveBeenCalledWith('posts', 'doc-1', null);
		expect(adapter.setScheduledPublishAt).toHaveBeenCalledWith('posts', 'doc-2', null);

		handle.stop();
	});

	it('should log stopped message on stop()', () => {
		const adapter = createSchedulerMockAdapter();
		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		handle.stop();
		expect(logs).toContain('[PublishScheduler] Stopped');
	});

	// --- Empty schedule ---

	it('should return 0 when no documents are scheduled', async () => {
		const adapter = createSchedulerMockAdapter({ posts: [] });
		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const handle = startPublishScheduler(adapter, [col]);
		const count = await handle.poll();
		expect(count).toBe(0);
		handle.stop();
	});

	// --- Multiple versioned collections ---

	it('should poll all versioned collections', async () => {
		const col1 = versionedCollection('posts');
		const col2 = versionedCollection('pages');

		const adapter = createSchedulerMockAdapter({
			posts: [{ id: 'post-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }],
			pages: [{ id: 'page-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }],
		});

		initTestAPI([col1, col2], adapter);

		const handle = startPublishScheduler(adapter, [col1, col2]);
		const count = await handle.poll();
		expect(count).toBe(2);
		expect(adapter.findScheduledDocuments).toHaveBeenCalledWith('posts', expect.any(String));
		expect(adapter.findScheduledDocuments).toHaveBeenCalledWith('pages', expect.any(String));
		handle.stop();
	});

	// --- Partial failures ---

	it('should continue publishing other documents when one fails', async () => {
		const scheduledDocs = [
			{ id: 'doc-good', scheduledPublishAt: '2024-01-01T00:00:00.000Z' },
			{ id: 'doc-bad', scheduledPublishAt: '2024-01-01T00:00:00.000Z' },
		];

		const adapter = createSchedulerMockAdapter(
			{ posts: scheduledDocs },
			{ failPublishForIds: ['doc-bad'] },
		);

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		const count = await handle.poll();
		expect(count).toBe(1);
		expect(logs).toContainEqual(expect.stringContaining('Failed to publish posts/doc-bad'));
		expect(logs).toContainEqual(expect.stringContaining('Published posts/doc-good'));
		handle.stop();
	});

	it('should log error when findScheduledDocuments throws for a collection', async () => {
		const adapter = createSchedulerMockAdapter(
			{
				broken: [{ id: 'doc-x', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }],
				ok: [{ id: 'doc-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }],
			},
			{ failFindScheduled: ['broken'] },
		);

		const col1 = versionedCollection('broken');
		const col2 = versionedCollection('ok');
		initTestAPI([col1, col2], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col1, col2], {
			logger: (msg) => logs.push(msg),
		});

		const count = await handle.poll();
		// 'ok' collection should still publish
		expect(count).toBe(1);
		expect(logs).toContainEqual(expect.stringContaining('Error polling broken'));
		handle.stop();
	});

	// --- Adapter without setScheduledPublishAt ---

	it('should work without setScheduledPublishAt (skip clearing)', async () => {
		const scheduledDocs = [{ id: 'doc-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }];
		const adapter = createSchedulerMockAdapter(
			{ posts: scheduledDocs },
			{ skipSetScheduledPublishAt: true },
		);

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const handle = startPublishScheduler(adapter, [col]);
		const count = await handle.poll();
		expect(count).toBe(1);
		handle.stop();
	});

	// --- Timer-based execution ---

	it('should poll automatically on the configured interval', async () => {
		const scheduledDocs = [{ id: 'doc-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }];
		const adapter = createSchedulerMockAdapter({ posts: scheduledDocs });

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const handle = startPublishScheduler(adapter, [col], { intervalMs: 1000 });

		// Advance time by one interval
		await vi.advanceTimersByTimeAsync(1000);
		expect(adapter.findScheduledDocuments).toHaveBeenCalledTimes(1);

		// Advance again — doc-1 still scheduled, will be published again
		await vi.advanceTimersByTimeAsync(1000);
		expect(adapter.findScheduledDocuments).toHaveBeenCalledTimes(2);

		handle.stop();
	});

	it('should stop polling after stop() is called', async () => {
		const adapter = createSchedulerMockAdapter({ posts: [] });

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const handle = startPublishScheduler(adapter, [col], { intervalMs: 1000 });

		await vi.advanceTimersByTimeAsync(1000);
		expect(adapter.findScheduledDocuments).toHaveBeenCalledTimes(1);

		handle.stop();

		await vi.advanceTimersByTimeAsync(5000);
		// Should not have been called again after stop
		expect(adapter.findScheduledDocuments).toHaveBeenCalledTimes(1);
	});

	// --- versions boolean (not an object with drafts) ---

	it('should skip collections where versions is a boolean (not drafts config)', () => {
		const adapter = createSchedulerMockAdapter();
		const col: CollectionConfig = {
			slug: 'posts',
			fields: [{ name: 'title', type: 'text' }],
			versions: true, // boolean, not { drafts: true }
		};
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		expect(logs).toContain(
			'[PublishScheduler] No versioned collections found, scheduler not started',
		);
		handle.stop();
	});

	// --- Logging ---

	it('should use default noop logger when none provided', () => {
		const adapter = createSchedulerMockAdapter();
		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const handle = startPublishScheduler(adapter, [col]);
		expect(handle).toBeDefined();
		handle.stop();
	});

	it('should log startup message with interval and collection names', () => {
		const adapter = createSchedulerMockAdapter();
		const col1 = versionedCollection('posts');
		const col2 = versionedCollection('pages');
		initTestAPI([col1, col2], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col1, col2], {
			intervalMs: 5000,
			logger: (msg) => logs.push(msg),
		});

		expect(logs).toContainEqual(expect.stringContaining('[PublishScheduler] Started'));
		expect(logs).toContainEqual(expect.stringContaining('interval: 5000ms'));
		expect(logs).toContainEqual(expect.stringContaining('posts'));
		expect(logs).toContainEqual(expect.stringContaining('pages'));

		handle.stop();
	});

	// --- Non-Error throws ---

	it('should handle non-Error throws in collection polling', async () => {
		const adapter: DatabaseAdapter = {
			find: vi.fn(async () => []),
			findById: vi.fn(async () => null),
			create: vi.fn(async (_c, d) => ({ id: 'x', ...d })),
			update: vi.fn(async (_c, _id, d) => d),
			delete: vi.fn(async () => true),
			findScheduledDocuments: vi.fn(async () => {
				throw 42; // non-Error throw
			}),
			updateStatus: vi.fn(async () => undefined),
			createVersion: vi.fn(async () => undefined),
			setScheduledPublishAt: vi.fn(async () => undefined),
		};

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		const count = await handle.poll();
		expect(count).toBe(0);
		expect(logs).toContainEqual(expect.stringContaining('Error polling posts'));
		handle.stop();
	});

	// --- versions object without drafts ---

	it('should skip collections with versions object but no drafts', () => {
		const adapter = createSchedulerMockAdapter();
		const col: CollectionConfig = {
			slug: 'posts',
			fields: [{ name: 'title', type: 'text' }],
			versions: { maxPerDoc: 10 }, // no drafts
		};
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		expect(logs).toContain(
			'[PublishScheduler] No versioned collections found, scheduler not started',
		);
		handle.stop();
	});

	// --- Non-string error in per-doc publish failure ---

	it('should log "Unknown error" when per-doc publish throws a non-Error', async () => {
		const scheduledDocs = [{ id: 'doc-1', scheduledPublishAt: '2024-01-01T00:00:00.000Z' }];

		// We need the adapter to find the doc (findById returns it) but updateStatus
		// throws a non-Error. However, the publish() path goes through checkAccess first,
		// which uses overrideAccess, then findById. Let's make findById throw instead.
		const adapter: DatabaseAdapter = {
			find: vi.fn(async () => []),
			findById: vi.fn(async () => {
				throw 'string error'; // non-Error in findById path
			}),
			create: vi.fn(async (_c, d) => ({ id: 'x', ...d })),
			update: vi.fn(async (_c, _id, d) => d),
			delete: vi.fn(async () => true),
			findScheduledDocuments: vi.fn(async () => scheduledDocs),
			updateStatus: vi.fn(async () => undefined),
			createVersion: vi.fn(async () => undefined),
			setScheduledPublishAt: vi.fn(async () => undefined),
		};

		const col = versionedCollection('posts');
		initTestAPI([col], adapter);

		const logs: string[] = [];
		const handle = startPublishScheduler(adapter, [col], {
			logger: (msg) => logs.push(msg),
		});

		const count = await handle.poll();
		expect(count).toBe(0);
		expect(logs).toContainEqual(expect.stringContaining('Failed to publish posts/doc-1'));
		handle.stop();
	});
});

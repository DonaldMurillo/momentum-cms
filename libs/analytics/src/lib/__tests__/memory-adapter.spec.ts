import { describe, it, expect } from 'vitest';
import { MemoryAnalyticsAdapter } from '../adapters/memory-adapter';
import type { AnalyticsEvent } from '../analytics-event.types';

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
	return {
		id: `evt-${Math.random().toString(36).slice(2, 8)}`,
		category: 'content',
		name: 'test_event',
		timestamp: new Date().toISOString(),
		properties: {},
		context: { source: 'server' },
		...overrides,
	};
}

describe('MemoryAnalyticsAdapter', () => {
	it('should store events', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		const events = [makeEvent(), makeEvent()];

		await adapter.store(events);

		expect(adapter.events).toHaveLength(2);
	});

	it('should accumulate events across multiple stores', async () => {
		const adapter = new MemoryAnalyticsAdapter();

		await adapter.store([makeEvent()]);
		await adapter.store([makeEvent(), makeEvent()]);

		expect(adapter.events).toHaveLength(3);
	});

	it('should query all events by default', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		await adapter.store([makeEvent({ name: 'a' }), makeEvent({ name: 'b' })]);

		const result = await adapter.query();

		expect(result.events).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(50);
	});

	it('should filter by category', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		await adapter.store([
			makeEvent({ category: 'content' }),
			makeEvent({ category: 'api' }),
			makeEvent({ category: 'content' }),
		]);

		const result = await adapter.query({ category: 'content' });

		expect(result.events).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it('should filter by name', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		await adapter.store([
			makeEvent({ name: 'page_view' }),
			makeEvent({ name: 'button_click' }),
			makeEvent({ name: 'page_view' }),
		]);

		const result = await adapter.query({ name: 'page_view' });

		expect(result.events).toHaveLength(2);
	});

	it('should filter by collection', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		await adapter.store([
			makeEvent({ context: { source: 'server', collection: 'posts' } }),
			makeEvent({ context: { source: 'server', collection: 'users' } }),
		]);

		const result = await adapter.query({ collection: 'posts' });

		expect(result.events).toHaveLength(1);
	});

	it('should filter by date range', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		await adapter.store([
			makeEvent({ timestamp: '2026-01-01T00:00:00.000Z' }),
			makeEvent({ timestamp: '2026-01-15T00:00:00.000Z' }),
			makeEvent({ timestamp: '2026-02-01T00:00:00.000Z' }),
		]);

		const result = await adapter.query({
			from: '2026-01-10T00:00:00.000Z',
			to: '2026-01-20T00:00:00.000Z',
		});

		expect(result.events).toHaveLength(1);
	});

	it('should paginate results', async () => {
		const adapter = new MemoryAnalyticsAdapter();
		const events = Array.from({ length: 5 }, (_, i) => makeEvent({ name: `event_${i}` }));
		await adapter.store(events);

		const page1 = await adapter.query({ limit: 2, page: 1 });
		expect(page1.events).toHaveLength(2);
		expect(page1.total).toBe(5);
		expect(page1.page).toBe(1);

		const page2 = await adapter.query({ limit: 2, page: 2 });
		expect(page2.events).toHaveLength(2);
		expect(page2.page).toBe(2);

		const page3 = await adapter.query({ limit: 2, page: 3 });
		expect(page3.events).toHaveLength(1);
	});
});

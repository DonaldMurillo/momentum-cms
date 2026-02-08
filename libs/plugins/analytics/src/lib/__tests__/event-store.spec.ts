import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventStore } from '../event-store';
import type { AnalyticsAdapter } from '../analytics-config.types';
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

function createMockAdapter(): AnalyticsAdapter {
	return {
		store: vi.fn().mockResolvedValue(undefined),
	};
}

describe('EventStore', () => {
	let adapter: AnalyticsAdapter;

	beforeEach(() => {
		vi.useFakeTimers();
		adapter = createMockAdapter();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should add events to the buffer', () => {
		const store = new EventStore({ adapter });
		store.add(makeEvent());
		store.add(makeEvent());
		expect(store.size).toBe(2);
	});

	it('should add batches of events', () => {
		const store = new EventStore({ adapter });
		store.addBatch([makeEvent(), makeEvent(), makeEvent()]);
		expect(store.size).toBe(3);
	});

	it('should flush events to the adapter', async () => {
		const store = new EventStore({ adapter });
		const events = [makeEvent(), makeEvent()];
		store.addBatch(events);

		await store.flush();

		expect(adapter.store).toHaveBeenCalledOnce();
		expect(adapter.store).toHaveBeenCalledWith(events);
		expect(store.size).toBe(0);
	});

	it('should not flush when buffer is empty', async () => {
		const store = new EventStore({ adapter });
		await store.flush();
		expect(adapter.store).not.toHaveBeenCalled();
	});

	it('should auto-flush when batch size is reached', () => {
		const store = new EventStore({ adapter, flushBatchSize: 3 });
		store.add(makeEvent());
		store.add(makeEvent());
		expect(adapter.store).not.toHaveBeenCalled();

		store.add(makeEvent()); // triggers flush
		expect(adapter.store).toHaveBeenCalledOnce();
	});

	it('should auto-flush addBatch when batch size is reached', () => {
		const store = new EventStore({ adapter, flushBatchSize: 2 });
		store.addBatch([makeEvent(), makeEvent(), makeEvent()]);
		expect(adapter.store).toHaveBeenCalledOnce();
	});

	it('should flush on interval when started', async () => {
		const store = new EventStore({ adapter, flushInterval: 1000 });
		store.start();

		store.add(makeEvent());

		// Advance past one interval tick and allow the async flush to resolve
		await vi.advanceTimersByTimeAsync(1000);

		expect(adapter.store).toHaveBeenCalledOnce();
		expect(store.size).toBe(0);

		await store.shutdown();
	});

	it('should not start multiple timers', () => {
		const store = new EventStore({ adapter, flushInterval: 1000 });
		store.start();
		store.start(); // second call should be a no-op

		store.add(makeEvent());
		vi.advanceTimersByTime(1000);

		// Should still only flush once per interval
		expect(store.size).toBe(0); // flushed via single timer
	});

	it('should flush remaining events on shutdown', async () => {
		const store = new EventStore({ adapter });
		store.add(makeEvent());
		store.add(makeEvent());

		await store.shutdown();

		expect(adapter.store).toHaveBeenCalledOnce();
		expect(store.size).toBe(0);
	});

	it('should stop the timer on shutdown', async () => {
		const localAdapter = createMockAdapter();
		const store = new EventStore({ adapter: localAdapter, flushInterval: 1000 });
		store.start();
		await store.shutdown();

		// After shutdown, adding events and advancing timers should not flush
		store.add(makeEvent());
		vi.advanceTimersByTime(5000);

		// The timer was cleared, so no auto-flush should occur
		expect(localAdapter.store).not.toHaveBeenCalled();
		expect(store.size).toBe(1);
	});

	it('should put events back on adapter failure', async () => {
		const failingAdapter = createMockAdapter();
		(failingAdapter.store as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error('Connection lost'),
		);

		const store = new EventStore({ adapter: failingAdapter });
		const event = makeEvent();
		store.add(event);

		await store.flush();

		// Events should be restored to buffer
		expect(store.size).toBe(1);
	});

	it('should use default flush interval of 5000ms', () => {
		const store = new EventStore({ adapter });
		store.start();
		store.add(makeEvent());

		vi.advanceTimersByTime(4999);
		expect(adapter.store).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		// Timer fired, flush triggered
		expect(store.size).toBe(0);

		store.shutdown();
	});

	it('should use default batch size of 100', () => {
		const store = new EventStore({ adapter });
		for (let i = 0; i < 99; i++) {
			store.add(makeEvent());
		}
		expect(adapter.store).not.toHaveBeenCalled();

		store.add(makeEvent()); // 100th event triggers flush
		expect(adapter.store).toHaveBeenCalledOnce();
	});
});

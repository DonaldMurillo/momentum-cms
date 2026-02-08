import { describe, it, expect, vi } from 'vitest';
import { MomentumEventBus } from '../event-bus/event-bus';
import type { CollectionEvent } from '../plugin.types';

function createEvent(
	collection: string,
	event: CollectionEvent['event'],
	operation?: CollectionEvent['operation'],
): CollectionEvent {
	return {
		collection,
		event,
		operation,
		doc: { id: '1' },
		timestamp: new Date().toISOString(),
	};
}

describe('MomentumEventBus', () => {
	it('should emit events to matching exact pattern subscribers', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('posts:afterChange', handler);
		bus.emit(createEvent('posts', 'afterChange', 'create'));

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler.mock.calls[0][0].collection).toBe('posts');
	});

	it('should not emit to non-matching subscribers', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('posts:afterDelete', handler);
		bus.emit(createEvent('posts', 'afterChange', 'create'));

		expect(handler).not.toHaveBeenCalled();
	});

	it('should support wildcard collection pattern (*:event)', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('*:afterDelete', handler);
		bus.emit(createEvent('posts', 'afterDelete', 'delete'));
		bus.emit(createEvent('users', 'afterDelete', 'delete'));

		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('should support wildcard event pattern (collection:*)', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('posts:*', handler);
		bus.emit(createEvent('posts', 'afterChange', 'create'));
		bus.emit(createEvent('posts', 'afterDelete', 'delete'));
		bus.emit(createEvent('users', 'afterChange', 'create'));

		expect(handler).toHaveBeenCalledTimes(2); // Only posts events
	});

	it('should support global wildcard (*)', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('*', handler);
		bus.emit(createEvent('posts', 'afterChange', 'create'));
		bus.emit(createEvent('users', 'afterDelete', 'delete'));

		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('should support multiple subscribers for the same pattern', () => {
		const bus = new MomentumEventBus();
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		bus.on('posts:afterChange', handler1);
		bus.on('posts:afterChange', handler2);
		bus.emit(createEvent('posts', 'afterChange', 'create'));

		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler2).toHaveBeenCalledTimes(1);
	});

	it('should return unsubscribe function', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		const unsub = bus.on('posts:afterChange', handler);

		bus.emit(createEvent('posts', 'afterChange', 'create'));
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();

		bus.emit(createEvent('posts', 'afterChange', 'create'));
		expect(handler).toHaveBeenCalledTimes(1); // Still 1
	});

	it('should clear all subscriptions', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('posts:afterChange', handler);
		bus.on('*:afterDelete', handler);

		expect(bus.size).toBe(2);

		bus.clear();

		expect(bus.size).toBe(0);

		bus.emit(createEvent('posts', 'afterChange', 'create'));
		expect(handler).not.toHaveBeenCalled();
	});

	it('should report subscription count via size', () => {
		const bus = new MomentumEventBus();

		expect(bus.size).toBe(0);

		const unsub1 = bus.on('a:b', vi.fn());
		bus.on('c:d', vi.fn());

		expect(bus.size).toBe(2);

		unsub1();

		expect(bus.size).toBe(1);
	});

	it('should support onCollection shorthand', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.onCollection('posts', handler);

		bus.emit(createEvent('posts', 'afterChange', 'create'));
		bus.emit(createEvent('posts', 'afterDelete', 'delete'));
		bus.emit(createEvent('users', 'afterChange', 'create'));

		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('should support onEvent shorthand', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.onEvent('afterDelete', handler);

		bus.emit(createEvent('posts', 'afterDelete', 'delete'));
		bus.emit(createEvent('users', 'afterDelete', 'delete'));
		bus.emit(createEvent('posts', 'afterChange', 'create'));

		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('should ignore invalid patterns gracefully', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		bus.on('invalid-pattern-no-colon', handler);
		bus.emit(createEvent('posts', 'afterChange', 'create'));

		expect(handler).not.toHaveBeenCalled();
	});

	it('should handle unsubscribe called multiple times', () => {
		const bus = new MomentumEventBus();
		const handler = vi.fn();

		const unsub = bus.on('posts:afterChange', handler);

		unsub();
		unsub(); // Should not throw

		expect(bus.size).toBe(0);
	});
});

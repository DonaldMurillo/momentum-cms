import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTracker } from '../client/tracker';

// Mock browser globals
const mockLocalStorage = new Map<string, string>();
const mockSessionStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
	getItem: (key: string) => mockLocalStorage.get(key) ?? null,
	setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
});

vi.stubGlobal('sessionStorage', {
	getItem: (key: string) => mockSessionStorage.get(key) ?? null,
	setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
});

vi.stubGlobal('location', { href: 'https://example.com/page' });
vi.stubGlobal('document', { referrer: 'https://google.com' });

const mockSendBeacon = vi.fn().mockReturnValue(true);
vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

/**
 * Extract the JSON body from a sendBeacon call.
 * The tracker sends a Blob with application/json content type.
 */
async function beaconBody(callIndex = 0): Promise<{ events: Array<Record<string, unknown>> }> {
	const arg = mockSendBeacon.mock.calls[callIndex][1];
	if (arg instanceof Blob) {
		const text = await arg.text();
		return JSON.parse(text);
	}
	return JSON.parse(arg);
}

// Track addEventListener/removeEventListener calls
const eventListeners: Record<string, (() => void)[]> = {};
vi.stubGlobal('addEventListener', (event: string, handler: () => void) => {
	eventListeners[event] = eventListeners[event] ?? [];
	eventListeners[event].push(handler);
});
vi.stubGlobal('removeEventListener', (event: string, handler: () => void) => {
	const list = eventListeners[event];
	if (list) {
		const idx = list.indexOf(handler);
		if (idx >= 0) list.splice(idx, 1);
	}
});

describe('createTracker', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockLocalStorage.clear();
		mockSessionStorage.clear();
		mockSendBeacon.mockClear();
		Object.keys(eventListeners).forEach((k) => delete eventListeners[k]);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should create a tracker with all methods', () => {
		const tracker = createTracker();
		expect(tracker.pageView).toBeDefined();
		expect(tracker.track).toBeDefined();
		expect(tracker.identify).toBeDefined();
		expect(tracker.flush).toBeDefined();
	});

	it('should generate and persist visitor ID', () => {
		createTracker();
		expect(mockLocalStorage.has('_m_vid')).toBe(true);
	});

	it('should reuse existing visitor ID', () => {
		mockLocalStorage.set('_m_vid', 'existing-vid');
		createTracker();
		expect(mockLocalStorage.get('_m_vid')).toBe('existing-vid');
	});

	it('should generate and persist session ID', () => {
		createTracker();
		expect(mockSessionStorage.has('_m_sid')).toBe(true);
	});

	it('should track page views with URL and referrer', async () => {
		const tracker = createTracker();
		tracker.pageView();
		tracker.flush();

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const body = await beaconBody();
		const event = body.events[0];

		expect(event.name).toBe('page_view');
		expect(event.category).toBe('page');
		expect(event['context']).toBeDefined();
		const ctx = event['context'] as Record<string, unknown>;
		expect(ctx['url']).toBe('https://example.com/page');
		expect(ctx['referrer']).toBe('https://google.com');
	});

	it('should track custom events', async () => {
		const tracker = createTracker();
		tracker.track('button_click', { buttonId: 'cta' });
		tracker.flush();

		const body = await beaconBody();
		const event = body.events[0];

		expect(event.name).toBe('button_click');
		expect(event.category).toBe('action');
		const props = event['properties'] as Record<string, unknown>;
		expect(props['buttonId']).toBe('cta');
	});

	it('should identify users', async () => {
		const tracker = createTracker();
		tracker.identify('user-123', { name: 'Test' });
		tracker.flush();

		const body = await beaconBody();
		const event = body.events[0];

		expect(event.name).toBe('identify');
		expect(event.userId).toBe('user-123');
		const props = event['properties'] as Record<string, unknown>;
		expect(props['name']).toBe('Test');
	});

	it('should include userId on subsequent events after identify', async () => {
		const tracker = createTracker();
		tracker.identify('user-123');
		tracker.track('action');
		tracker.flush();

		const body = await beaconBody();
		// Both events should have userId
		expect(body.events[0].userId).toBe('user-123');
		expect(body.events[1].userId).toBe('user-123');
	});

	it('should batch events and flush on interval', async () => {
		const tracker = createTracker({ flushInterval: 2000 });
		tracker.track('event_1');
		tracker.track('event_2');

		expect(mockSendBeacon).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const body = await beaconBody();
		expect(body.events).toHaveLength(2);
	});

	it('should not flush when buffer is empty', () => {
		const tracker = createTracker();
		tracker.flush();
		expect(mockSendBeacon).not.toHaveBeenCalled();
	});

	it('should use sendBeacon for delivery', () => {
		const tracker = createTracker({ endpoint: '/custom/collect' });
		tracker.track('test');
		tracker.flush();

		expect(mockSendBeacon).toHaveBeenCalledWith('/custom/collect', expect.any(Blob));
	});

	it('should include sessionId and visitorId on all events', async () => {
		const tracker = createTracker();
		tracker.track('test');
		tracker.flush();

		const body = await beaconBody();
		const event = body.events[0];

		expect(event.sessionId).toBeDefined();
		expect(event.visitorId).toBeDefined();
		expect(typeof event.sessionId).toBe('string');
		expect(typeof event.visitorId).toBe('string');
	});

	it('should register beforeunload listener', () => {
		createTracker();
		expect(eventListeners['beforeunload']).toBeDefined();
		expect(eventListeners['beforeunload']).toHaveLength(1);
	});

	it('should use default endpoint /api/analytics/collect', () => {
		const tracker = createTracker();
		tracker.track('test');
		tracker.flush();

		expect(mockSendBeacon).toHaveBeenCalledWith('/api/analytics/collect', expect.any(Blob));
	});

	it('should accept custom page view properties', async () => {
		const tracker = createTracker();
		tracker.pageView({ section: 'blog' });
		tracker.flush();

		const body = await beaconBody();
		const props = body.events[0]['properties'] as Record<string, unknown>;
		expect(props['section']).toBe('blog');
	});

	it('should expose a destroy method', () => {
		const tracker = createTracker();
		expect(tracker.destroy).toBeDefined();
		expect(typeof tracker.destroy).toBe('function');
	});

	it('should flush pending events on destroy', async () => {
		const tracker = createTracker();
		tracker.track('pending_event');

		expect(mockSendBeacon).not.toHaveBeenCalled();

		tracker.destroy();

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const body = await beaconBody();
		expect(body.events[0].name).toBe('pending_event');
	});

	it('should stop the flush timer on destroy', () => {
		const tracker = createTracker({ flushInterval: 2000 });
		tracker.track('event_1');

		tracker.destroy();
		mockSendBeacon.mockClear();

		// Advance past the flush interval — no more flushes should happen
		vi.advanceTimersByTime(5000);
		expect(mockSendBeacon).not.toHaveBeenCalled();
	});
});

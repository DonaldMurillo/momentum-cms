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

// Track addEventListener calls
const eventListeners: Record<string, (() => void)[]> = {};
vi.stubGlobal('addEventListener', (event: string, handler: () => void) => {
	eventListeners[event] = eventListeners[event] ?? [];
	eventListeners[event].push(handler);
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

	it('should track page views with URL and referrer', () => {
		const tracker = createTracker();
		tracker.pageView();
		tracker.flush();

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
		const event = body.events[0];

		expect(event.name).toBe('page_view');
		expect(event.category).toBe('page');
		expect(event.context.url).toBe('https://example.com/page');
		expect(event.context.referrer).toBe('https://google.com');
	});

	it('should track custom events', () => {
		const tracker = createTracker();
		tracker.track('button_click', { buttonId: 'cta' });
		tracker.flush();

		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
		const event = body.events[0];

		expect(event.name).toBe('button_click');
		expect(event.category).toBe('action');
		expect(event.properties.buttonId).toBe('cta');
	});

	it('should identify users', () => {
		const tracker = createTracker();
		tracker.identify('user-123', { name: 'Test' });
		tracker.flush();

		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
		const event = body.events[0];

		expect(event.name).toBe('identify');
		expect(event.userId).toBe('user-123');
		expect(event.properties.name).toBe('Test');
	});

	it('should include userId on subsequent events after identify', () => {
		const tracker = createTracker();
		tracker.identify('user-123');
		tracker.track('action');
		tracker.flush();

		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
		// Both events should have userId
		expect(body.events[0].userId).toBe('user-123');
		expect(body.events[1].userId).toBe('user-123');
	});

	it('should batch events and flush on interval', () => {
		const tracker = createTracker({ flushInterval: 2000 });
		tracker.track('event_1');
		tracker.track('event_2');

		expect(mockSendBeacon).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
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

		expect(mockSendBeacon).toHaveBeenCalledWith('/custom/collect', expect.any(String));
	});

	it('should include sessionId and visitorId on all events', () => {
		const tracker = createTracker();
		tracker.track('test');
		tracker.flush();

		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
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

		expect(mockSendBeacon).toHaveBeenCalledWith('/api/analytics/collect', expect.any(String));
	});

	it('should accept custom page view properties', () => {
		const tracker = createTracker();
		tracker.pageView({ section: 'blog' });
		tracker.flush();

		const body = JSON.parse(mockSendBeacon.mock.calls[0][1] as string);
		expect(body.events[0].properties.section).toBe('blog');
	});
});

/* eslint-disable local/no-direct-browser-apis -- Standalone client tracker, not Angular-managed */

/**
 * Client-Side Analytics Tracker
 *
 * Lightweight JS snippet (~2KB) for tracking page views and custom actions.
 * Designed to be served as a standalone script or imported in frontend apps.
 *
 * Features:
 * - Auto-generates visitorId (localStorage) and sessionId (sessionStorage)
 * - Batches events and flushes every 5s or on beforeunload
 * - Uses navigator.sendBeacon() for reliable delivery on page exit
 */

/**
 * Tracker configuration.
 */
export interface TrackerConfig {
	/** Ingest endpoint URL. @default '/api/analytics/collect' */
	endpoint?: string;
	/** Flush interval in ms. @default 5000 */
	flushInterval?: number;
}

/**
 * Client event structure (before server enrichment).
 */
export interface ClientEvent {
	name: string;
	category?: string;
	properties?: Record<string, unknown>;
	context?: {
		url?: string;
		referrer?: string;
	};
	sessionId?: string;
	visitorId?: string;
}

/**
 * Momentum Analytics Tracker interface.
 */
export interface MomentumTracker {
	/** Track a page view (auto-captures URL, referrer) */
	pageView(properties?: Record<string, unknown>): void;
	/** Track a custom action */
	track(name: string, properties?: Record<string, unknown>): void;
	/** Identify the current user */
	identify(userId: string, traits?: Record<string, unknown>): void;
	/** Flush pending events */
	flush(): void;
}

/**
 * Generate or retrieve a visitor ID from localStorage.
 */
function getVisitorId(): string {
	if (typeof localStorage === 'undefined') return 'server';

	let visitorId = localStorage.getItem('_m_vid');
	if (!visitorId) {
		visitorId = generateId();
		localStorage.setItem('_m_vid', visitorId);
	}
	return visitorId;
}

/**
 * Generate or retrieve a session ID from sessionStorage.
 */
function getSessionId(): string {
	if (typeof sessionStorage === 'undefined') return 'server';

	let sessionId = sessionStorage.getItem('_m_sid');
	if (!sessionId) {
		sessionId = generateId();
		sessionStorage.setItem('_m_sid', sessionId);
	}
	return sessionId;
}

/**
 * Generate a simple random ID.
 */
function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Create a Momentum Analytics tracker.
 *
 * @param config - Tracker configuration
 * @returns Tracker instance
 *
 * @example
 * ```typescript
 * const tracker = createTracker({ endpoint: '/api/analytics/collect' });
 * tracker.pageView();
 * tracker.track('button_click', { buttonId: 'cta-signup' });
 * ```
 */
export function createTracker(config: TrackerConfig = {}): MomentumTracker {
	const endpoint = config.endpoint ?? '/api/analytics/collect';
	const flushInterval = config.flushInterval ?? 5000;

	const buffer: ClientEvent[] = [];
	let userId: string | undefined;
	let _timer: ReturnType<typeof setInterval> | null = null;

	const visitorId = getVisitorId();
	const sessionId = getSessionId();

	function addEvent(event: ClientEvent): void {
		buffer.push({
			...event,
			sessionId,
			visitorId,
		});
	}

	function flush(): void {
		if (buffer.length === 0) return;

		const events = buffer.splice(0, buffer.length).map((e) => ({
			...e,
			userId,
		}));

		const body = JSON.stringify({ events });

		// Use sendBeacon if available (reliable on page exit)
		if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
			navigator.sendBeacon(endpoint, body);
		} else if (typeof fetch !== 'undefined') {
			void fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
				keepalive: true,
			});
		}
	}

	// Start flush timer
	if (typeof setInterval !== 'undefined') {
		_timer = setInterval(flush, flushInterval);
	}

	// Flush on page exit
	if (typeof addEventListener !== 'undefined') {
		addEventListener('beforeunload', flush);
	}

	return {
		pageView(properties?: Record<string, unknown>): void {
			addEvent({
				name: 'page_view',
				category: 'page',
				properties,
				context: {
					url: typeof location !== 'undefined' ? location.href : undefined,
					referrer: typeof document !== 'undefined' ? document.referrer : undefined,
				},
			});
		},

		track(name: string, properties?: Record<string, unknown>): void {
			addEvent({
				name,
				category: 'action',
				properties,
				context: {
					url: typeof location !== 'undefined' ? location.href : undefined,
				},
			});
		},

		identify(id: string, traits?: Record<string, unknown>): void {
			userId = id;
			addEvent({
				name: 'identify',
				category: 'custom',
				properties: traits,
			});
		},

		flush,
	};
}

/* eslint-disable local/no-direct-browser-apis -- Standalone client tracker, not Angular-managed */

/**
 * Rule Engine
 *
 * Client-side engine for admin-managed element tracking rules.
 * Fetches active rules from the server, filters by current URL,
 * and attaches event listeners/observers for matching elements.
 *
 * Supports SPA navigation by wrapping pushState/replaceState and
 * listening for popstate to re-filter rules on route changes.
 */

import type { MomentumTracker } from './tracker';
import { isRecord } from '../utils/type-guards';
import { isSelectorBlocked } from '../utils/selector-security';

/**
 * Rule engine configuration.
 */
export interface RuleEngineConfig {
	/** Rules endpoint URL. @default '/api/analytics/tracking-rules' */
	endpoint?: string;
}

/**
 * Rule engine instance.
 */
export interface RuleEngine {
	/** Fetch rules and start tracking for the current URL */
	start(): Promise<void>;
	/** Stop all tracking and clean up listeners */
	stop(): void;
	/** Re-filter rules and re-attach listeners for a new URL (SPA navigation) */
	onNavigate(url: string): void;
}

/**
 * A tracking rule as received from the server.
 */
interface ClientRule {
	name: string;
	selector: string;
	eventType: string;
	eventName: string;
	urlPattern: string;
	properties: Record<string, unknown>;
	extractProperties?: unknown[];
	active: boolean;
	rateLimit?: number;
}

/**
 * Match a URL pathname against a glob pattern.
 * Supports `*` (any single path segment) and `**` (any path depth).
 */
export function matchUrlPattern(pattern: string, pathname: string): boolean {
	if (pattern === '*') return true;

	const escaped = pattern
		.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '\0GLOBSTAR\0')
		.replace(/\*/g, '[^/]*')
		.replace(/\0GLOBSTAR\0/g, '.*');

	return new RegExp(`^${escaped}$`).test(pathname);
}

/**
 * Validate and narrow a server response to a rules array.
 * Rejects rules with selectors targeting sensitive form inputs.
 */
export function parseRulesResponse(data: unknown): ClientRule[] {
	if (!isRecord(data) || !Array.isArray(data['rules'])) return [];

	const result: ClientRule[] = [];
	for (const item of data['rules']) {
		if (!isRecord(item)) continue;
		if (typeof item['selector'] !== 'string' || typeof item['eventName'] !== 'string') continue;

		// Block rules targeting sensitive form inputs
		if (isSelectorBlocked(item['selector'])) continue;

		result.push({
			name: typeof item['name'] === 'string' ? item['name'] : '',
			selector: item['selector'],
			eventType: typeof item['eventType'] === 'string' ? item['eventType'] : 'click',
			eventName: item['eventName'],
			urlPattern: typeof item['urlPattern'] === 'string' ? item['urlPattern'] : '*',
			properties: isRecord(item['properties']) ? item['properties'] : {},
			extractProperties: Array.isArray(item['extractProperties'])
				? item['extractProperties']
				: undefined,
			active: item['active'] === true,
			rateLimit: typeof item['rateLimit'] === 'number' ? item['rateLimit'] : undefined,
		});
	}
	return result;
}

/**
 * Attributes blocked from extraction to prevent data exfiltration.
 */
const BLOCKED_ATTRIBUTES = new Set(['value', 'password', 'autocomplete', 'autofill']);

/** Maximum length for extracted values (defense-in-depth). */
const MAX_EXTRACT_LENGTH = 200;

/**
 * Truncate a string to a maximum length.
 */
function truncate(val: string, max: number): string {
	return val.length > max ? val.slice(0, max) : val;
}

/**
 * Extract properties from a matched DOM element based on rule extraction config.
 * Applies security blocklists and length caps to prevent data exfiltration.
 */
function extractProperties(el: HTMLElement, rule: ClientRule): Record<string, unknown> {
	const props: Record<string, unknown> = { ...rule.properties };

	if (!Array.isArray(rule.extractProperties)) return props;

	for (const raw of rule.extractProperties) {
		if (!isRecord(raw)) continue;
		const key = typeof raw['key'] === 'string' ? raw['key'] : null;
		const source = typeof raw['source'] === 'string' ? raw['source'] : null;
		if (!key || !source) continue;

		const maxLen = typeof raw['maxLength'] === 'number' ? raw['maxLength'] : MAX_EXTRACT_LENGTH;

		switch (source) {
			case 'text':
				props[key] = truncate(el.textContent?.trim() ?? '', maxLen);
				break;
			case 'attribute': {
				const attr = typeof raw['attribute'] === 'string' ? raw['attribute'] : '';
				// Block extraction of sensitive attributes
				if (BLOCKED_ATTRIBUTES.has(attr.toLowerCase())) break;
				props[key] = truncate(el.getAttribute(attr) ?? '', maxLen);
				break;
			}
			case 'dataset': {
				const dsKey = typeof raw['attribute'] === 'string' ? raw['attribute'] : '';
				props[key] = truncate(el.dataset[dsKey] ?? '', maxLen);
				break;
			}
		}
	}

	return props;
}

/**
 * Create a client-side rule engine.
 *
 * @param tracker - Momentum tracker instance for event emission
 * @param config - Rule engine configuration
 * @returns Rule engine instance
 *
 * @example
 * ```typescript
 * const engine = createRuleEngine(tracker, { endpoint: '/api/analytics/tracking-rules' });
 * await engine.start();
 * // On SPA navigation:
 * engine.onNavigate('/new-path');
 * // Cleanup:
 * engine.stop();
 * ```
 */
export function createRuleEngine(
	tracker: MomentumTracker,
	config: RuleEngineConfig = {},
): RuleEngine {
	const endpoint = config.endpoint ?? '/api/analytics/tracking-rules';

	let rules: ClientRule[] = [];
	let activeCleanups: Array<() => void> = [];
	let running = false;
	let navigationCleanup: (() => void) | null = null;

	// Per-rule rate limiting: eventName → { count, resetAt }
	const rateLimits = new Map<string, { count: number; resetAt: number }>();

	function checkRateLimit(rule: ClientRule): boolean {
		if (!rule.rateLimit) return true;

		const now = Date.now();
		const state = rateLimits.get(rule.eventName);

		if (!state || now >= state.resetAt) {
			rateLimits.set(rule.eventName, { count: 1, resetAt: now + 60_000 });
			return true;
		}

		if (state.count >= rule.rateLimit) return false;
		state.count++;
		return true;
	}

	function fireRule(rule: ClientRule, el: HTMLElement): void {
		if (!checkRateLimit(rule)) return;
		tracker.track(rule.eventName, extractProperties(el, rule));
	}

	/**
	 * Apply matching rules for the given URL pathname.
	 * Cleans up previous listeners and re-attaches for new URL.
	 */
	function attachRulesForUrl(url: string): void {
		for (const cleanup of activeCleanups) cleanup();
		activeCleanups = [];

		const pathname = url.startsWith('http') ? new URL(url).pathname : url;
		const matching = rules.filter((r) => r.active && matchUrlPattern(r.urlPattern, pathname));

		if (matching.length === 0) return;

		// Group delegated events by DOM event type
		const delegatedTypes: Array<{ eventType: string; domEvent: string; capture: boolean }> = [
			{ eventType: 'click', domEvent: 'click', capture: false },
			{ eventType: 'submit', domEvent: 'submit', capture: true },
			{ eventType: 'hover', domEvent: 'mouseenter', capture: true },
			{ eventType: 'focus', domEvent: 'focusin', capture: false },
		];

		for (const { eventType, domEvent, capture } of delegatedTypes) {
			const typeRules = matching.filter((r) => r.eventType === eventType);
			if (typeRules.length === 0) continue;

			const handler = (e: Event): void => {
				const target = e.target;
				if (!(target instanceof HTMLElement)) return;

				for (const rule of typeRules) {
					const matched = target.closest(rule.selector);
					if (matched instanceof HTMLElement) {
						fireRule(rule, matched);
					}
				}
			};

			document.body.addEventListener(domEvent, handler, capture);
			activeCleanups.push(() => document.body.removeEventListener(domEvent, handler, capture));
		}

		// Scroll-into-view via IntersectionObserver
		const scrollRules = matching.filter((r) => r.eventType === 'scroll-into-view');
		if (scrollRules.length > 0) {
			const seen = new Set<string>();
			const observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const el = entry.target;
						if (!(el instanceof HTMLElement)) continue;

						for (const rule of scrollRules) {
							if (!el.matches(rule.selector)) continue;
							const key = `${rule.eventName}:${rule.selector}`;
							if (seen.has(key)) continue;
							seen.add(key);
							fireRule(rule, el);
							observer.unobserve(el);
						}
					}
				},
				{ threshold: 0.5 },
			);

			for (const rule of scrollRules) {
				const elements = Array.from(document.querySelectorAll(rule.selector));
				for (const el of elements) observer.observe(el);
			}

			activeCleanups.push(() => observer.disconnect());
		}
	}

	/**
	 * Set up SPA navigation detection.
	 * Wraps pushState/replaceState and listens for popstate.
	 */
	function setupNavigationDetection(): () => void {
		const cleanups: Array<() => void> = [];

		const popstateHandler = (): void => {
			if (running) attachRulesForUrl(location.pathname);
		};
		window.addEventListener('popstate', popstateHandler);
		cleanups.push(() => window.removeEventListener('popstate', popstateHandler));

		const originalPushState = history.pushState.bind(history);
		const originalReplaceState = history.replaceState.bind(history);

		history.pushState = function (...args: Parameters<typeof history.pushState>): void {
			originalPushState(...args);
			if (running) attachRulesForUrl(location.pathname);
		};

		history.replaceState = function (...args: Parameters<typeof history.replaceState>): void {
			originalReplaceState(...args);
			if (running) attachRulesForUrl(location.pathname);
		};

		cleanups.push(() => {
			history.pushState = originalPushState;
			history.replaceState = originalReplaceState;
		});

		return (): void => {
			for (const fn of cleanups) fn();
		};
	}

	return {
		async start(): Promise<void> {
			try {
				const res = await fetch(endpoint);
				if (!res.ok) return;
				const data: unknown = await res.json();
				rules = parseRulesResponse(data);
			} catch {
				return; // Silently fail — rules are optional
			}

			if (rules.length === 0) return;

			running = true;
			attachRulesForUrl(location.pathname);
			navigationCleanup = setupNavigationDetection();
		},

		stop(): void {
			running = false;
			for (const cleanup of activeCleanups) cleanup();
			activeCleanups = [];
			navigationCleanup?.();
			navigationCleanup = null;
			rateLimits.clear();
		},

		onNavigate(url: string): void {
			if (running) attachRulesForUrl(url);
		},
	};
}

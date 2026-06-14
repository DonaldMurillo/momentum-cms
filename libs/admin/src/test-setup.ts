/* eslint-disable local/no-direct-browser-apis -- jsdom test setup intentionally
 * patches the global window.matchMedia. The SSR-safe `inject(DOCUMENT).defaultView`
 * pattern is for runtime code; this file only runs inside vitest's jsdom env. */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- runtime polyfill
 * for legacy MediaQueryList methods that jsdom 26 omits; the assertion narrows
 * the unknown shape returned by the host platform's matchMedia. */

/**
 * Vitest setup for libs/admin.
 *
 * jsdom 26 implements `window.matchMedia` via the modern EventTarget API
 * (`addEventListener` / `removeEventListener`) but does NOT include the
 * legacy `addListener` / `removeListener` methods that Angular CDK's
 * `BreakpointObserver` still calls (cdk@21 → `_breakpoints-observer-chunk.mjs`
 * line ~125: `mql.addListener(handler)`). When CDK detects a non-noop
 * `window.matchMedia` it skips the polyfill path, so the legacy methods
 * must exist on the MediaQueryList or every `BreakpointObserver.observe()`
 * subscription throws an unhandled `TypeError`.
 */
const realMatchMedia = window.matchMedia?.bind(window);

window.matchMedia = (query: string): MediaQueryList => {
	const mql = realMatchMedia ? realMatchMedia(query) : ({} as MediaQueryList);
	const ext = mql as MediaQueryList & {
		addListener?: (l: (event: MediaQueryListEvent) => void) => void;
		removeListener?: (l: (event: MediaQueryListEvent) => void) => void;
	};
	if (typeof ext.addListener !== 'function') {
		Object.defineProperty(mql, 'addListener', {
			configurable: true,
			value: (listener: (event: MediaQueryListEvent) => void) =>
				mql.addEventListener?.('change', listener),
		});
	}
	if (typeof ext.removeListener !== 'function') {
		Object.defineProperty(mql, 'removeListener', {
			configurable: true,
			value: (listener: (event: MediaQueryListEvent) => void) =>
				mql.removeEventListener?.('change', listener),
		});
	}
	return mql;
};

/**
 * Initialise Angular's TestBed environment so `TestBed.configureTestingModule`
 * works inside vitest specs. Without this, the very first call throws
 * "Need to call TestBed.initTestEnvironment() first" — silently masking every
 * component spec in this lib.
 */
import { getTestBed } from '@angular/core/testing';
import {
	BrowserDynamicTestingModule,
	platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

try {
	getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
		teardown: { destroyAfterEach: true },
	});
} catch (err) {
	// Re-init is fine in watch mode; only rethrow if it's an unrelated error.
	if (!String(err).includes('Cannot set base providers')) throw err;
}

/**
 * Angular Page View Tracker
 *
 * Subscribes to Angular Router NavigationEnd events and sends page_view
 * analytics events via HttpClient. This captures SPA navigations that
 * the server-side Express middleware cannot see.
 *
 * Browser-safe: excluded from the Node CJS lib build.
 */

import {
	Injectable,
	InjectionToken,
	inject,
	DestroyRef,
	PLATFORM_ID,
	makeEnvironmentProviders,
	ENVIRONMENT_INITIALIZER,
	type EnvironmentProviders,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs';
import { compileContentRoutes, type CompiledContentRoute } from './utils/content-route-matcher';
import {
	shouldTrackNavigation,
	buildPageViewEvent,
	DEFAULT_EXCLUDE_PREFIXES,
} from './page-view-tracker.utils';

// Re-export utils for consumers
export {
	shouldTrackNavigation,
	buildPageViewEvent,
	DEFAULT_EXCLUDE_PREFIXES,
} from './page-view-tracker.utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the page view tracker. */
export interface PageViewTrackingConfig {
	/** Map of collection slug -> URL pattern (e.g. `{ articles: '/articles/:slug' }`) */
	contentRoutes?: Record<string, string>;
	/** Ingest endpoint URL. @default '/api/analytics/collect' */
	endpoint?: string;
	/** Additional path prefixes to exclude from tracking. */
	excludePrefixes?: readonly string[];
}

/** Injection token for the page view tracking config. */
export const PAGE_VIEW_TRACKING_CONFIG = new InjectionToken<PageViewTrackingConfig>(
	'PAGE_VIEW_TRACKING_CONFIG',
);

// ---------------------------------------------------------------------------
// Visitor / Session ID helpers (mirrors client/tracker.ts logic)
// ---------------------------------------------------------------------------

function getOrCreateStorageId(storage: Storage, key: string): string {
	let id = storage.getItem(key);
	if (!id) {
		id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
		storage.setItem(key, id);
	}
	return id;
}

// ---------------------------------------------------------------------------
// Angular Service
// ---------------------------------------------------------------------------

/**
 * Angular service that tracks SPA page view navigations.
 *
 * Listens to `Router.events` for `NavigationEnd`, skips the initial SSR-rendered
 * page, and POSTs page_view events to the analytics ingest endpoint.
 */
@Injectable()
export class PageViewTrackerService {
	private readonly router = inject(Router);
	private readonly http = inject(HttpClient);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly destroyRef = inject(DestroyRef);
	private readonly config = inject(PAGE_VIEW_TRACKING_CONFIG);
	private readonly doc = inject(DOCUMENT);

	private readonly endpoint: string;
	private readonly compiledRoutes: readonly CompiledContentRoute[] | undefined;
	private readonly excludePrefixes: readonly string[];
	private isFirstNavigation = true;

	constructor() {
		this.endpoint = this.config.endpoint ?? '/api/analytics/collect';
		this.compiledRoutes = this.config.contentRoutes
			? compileContentRoutes(this.config.contentRoutes)
			: undefined;
		this.excludePrefixes = this.config.excludePrefixes
			? [...DEFAULT_EXCLUDE_PREFIXES, ...this.config.excludePrefixes]
			: DEFAULT_EXCLUDE_PREFIXES;

		if (!isPlatformBrowser(this.platformId)) return;

		const sub = this.router.events
			.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
			.subscribe((event) => {
				const url = event.urlAfterRedirects;

				if (!shouldTrackNavigation(url, this.isFirstNavigation, this.excludePrefixes)) {
					this.isFirstNavigation = false;
					return;
				}
				this.isFirstNavigation = false;

				this.trackPageView(url);
			});

		this.destroyRef.onDestroy(() => sub.unsubscribe());
	}

	private trackPageView(url: string): void {
		const eventPayload = buildPageViewEvent(url, this.compiledRoutes);

		const win = this.doc.defaultView;

		let visitorId: string | undefined;
		let sessionId: string | undefined;
		try {
			if (win?.localStorage) visitorId = getOrCreateStorageId(win.localStorage, '_m_vid');
			if (win?.sessionStorage) sessionId = getOrCreateStorageId(win.sessionStorage, '_m_sid');
		} catch {
			// Storage may be unavailable (private browsing, etc.)
		}

		const clientEvent = {
			...eventPayload,
			context: {
				url: win?.location?.href ?? '',
				referrer: this.doc.referrer,
			},
			visitorId,
			sessionId,
		};

		this.http.post(this.endpoint, { events: [clientEvent] }).subscribe();
	}
}

// ---------------------------------------------------------------------------
// Provider function
// ---------------------------------------------------------------------------

/**
 * Provide client-side page view tracking for an Angular application.
 *
 * @example
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePageViewTracking({
 *       contentRoutes: {
 *         articles: '/articles/:slug',
 *         pages: '/:slug',
 *       },
 *     }),
 *   ],
 * };
 * ```
 */
export function providePageViewTracking(config: PageViewTrackingConfig): EnvironmentProviders {
	return makeEnvironmentProviders([
		{ provide: PAGE_VIEW_TRACKING_CONFIG, useValue: config },
		PageViewTrackerService,
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				// Injecting the service triggers its constructor, which starts tracking
				inject(PageViewTrackerService);
				return (): void => {
					/* no-op — cleanup handled by DestroyRef */
				};
			},
		},
	]);
}

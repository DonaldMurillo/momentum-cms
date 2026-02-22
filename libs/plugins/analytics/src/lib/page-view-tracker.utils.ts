/**
 * Page View Tracker — Pure Logic
 *
 * Testable functions used by the Angular PageViewTrackerService.
 * No Angular dependencies — safe for Node.js and Vitest environments.
 */

import { matchContentRoute, type CompiledContentRoute } from './utils/content-route-matcher';

/** Default path prefixes excluded from client-side page view tracking. */
export const DEFAULT_EXCLUDE_PREFIXES: readonly string[] = ['/admin', '/api/'];

/**
 * Determine whether a navigation should be tracked.
 *
 * @param url - The navigated URL (may include query string / fragment)
 * @param isFirstNavigation - True for the initial route (already tracked by SSR)
 * @param excludePrefixes - Path prefixes to skip
 */
export function shouldTrackNavigation(
	url: string,
	isFirstNavigation: boolean,
	excludePrefixes: readonly string[],
): boolean {
	if (isFirstNavigation) return false;

	const path = url.split('?')[0].split('#')[0];

	for (const prefix of excludePrefixes) {
		if (path.startsWith(prefix)) return false;
	}

	return true;
}

/**
 * Build a page_view client event payload from a URL.
 *
 * @param url - The navigated URL (may include query / fragment)
 * @param compiledRoutes - Pre-compiled content routes for collection matching
 */
export function buildPageViewEvent(
	url: string,
	compiledRoutes: readonly CompiledContentRoute[] | undefined,
): { name: string; category: string; properties: Record<string, unknown> } {
	const path = url.split('?')[0].split('#')[0];

	const properties: Record<string, unknown> = { path };

	if (compiledRoutes) {
		const routeMatch = matchContentRoute(path, compiledRoutes);
		if (routeMatch) {
			properties['collection'] = routeMatch.collection;
			properties['slug'] = routeMatch.params['slug'];
		}
	}

	return {
		name: 'page_view',
		category: 'page',
		properties,
	};
}

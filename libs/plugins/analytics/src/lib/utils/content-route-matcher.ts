/**
 * Content Route Matcher
 *
 * Compiles Express-style :param patterns into matchers for
 * attributing page views to CMS collections.
 */

/** A compiled content route matcher. */
export interface CompiledContentRoute {
	/** Collection slug this route maps to */
	collection: string;
	/** Original pattern string */
	pattern: string;
	/** Compiled regex */
	regex: RegExp;
	/** Ordered parameter names extracted from the pattern */
	paramNames: readonly string[];
	/** Number of static (non-param) segments — used for priority sorting */
	staticSegments: number;
}

/** Result of matching a URL against content routes. */
export interface ContentRouteMatch {
	/** Collection slug */
	collection: string;
	/** Extracted route parameters */
	params: Record<string, string>;
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a single route pattern into a regex matcher.
 *
 * Supports Express-style `:paramName` segments.
 * e.g. `/articles/:slug` compiles to `/^\/articles\/([^/]+)\/?$/`
 */
export function compileContentRoute(collection: string, pattern: string): CompiledContentRoute {
	const segments = pattern.split('/').filter(Boolean);
	const paramNames: string[] = [];
	let staticCount = 0;

	const regexParts = segments.map((seg) => {
		if (seg.startsWith(':')) {
			paramNames.push(seg.slice(1));
			return '([^/]+)';
		}
		staticCount++;
		return escapeRegex(seg);
	});

	const regexStr = '^/' + regexParts.join('/') + '/?$';

	return {
		collection,
		pattern,
		regex: new RegExp(regexStr),
		paramNames,
		staticSegments: staticCount,
	};
}

/**
 * Compile all content routes, sorted by specificity (most static segments first).
 */
export function compileContentRoutes(routes: Record<string, string>): CompiledContentRoute[] {
	const compiled = Object.entries(routes).map(([collection, pattern]) =>
		compileContentRoute(collection, pattern),
	);

	compiled.sort((a, b) => b.staticSegments - a.staticSegments);

	return compiled;
}

/**
 * Match a URL path against compiled content routes.
 * Returns the first (highest-priority) match, or undefined.
 */
export function matchContentRoute(
	path: string,
	routes: readonly CompiledContentRoute[],
): ContentRouteMatch | undefined {
	for (const route of routes) {
		const match = route.regex.exec(path);
		if (match) {
			const params: Record<string, string> = {};
			for (let i = 0; i < route.paramNames.length; i++) {
				params[route.paramNames[i]] = match[i + 1];
			}
			return { collection: route.collection, params };
		}
	}
	return undefined;
}

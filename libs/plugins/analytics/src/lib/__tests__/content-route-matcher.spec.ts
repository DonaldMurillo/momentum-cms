import { describe, it, expect } from 'vitest';
import {
	compileContentRoute,
	compileContentRoutes,
	matchContentRoute,
} from '../utils/content-route-matcher';

describe('compileContentRoute', () => {
	it('should compile a single-param pattern', () => {
		const route = compileContentRoute('articles', '/articles/:slug');
		expect(route.collection).toBe('articles');
		expect(route.pattern).toBe('/articles/:slug');
		expect(route.paramNames).toEqual(['slug']);
		expect(route.staticSegments).toBe(1);
		expect(route.regex.test('/articles/my-post')).toBe(true);
	});

	it('should compile a multi-param pattern', () => {
		const route = compileContentRoute('blog', '/blog/:year/:slug');
		expect(route.paramNames).toEqual(['year', 'slug']);
		expect(route.staticSegments).toBe(1);
		expect(route.regex.test('/blog/2024/my-post')).toBe(true);
	});

	it('should compile a root-level catch-all', () => {
		const route = compileContentRoute('pages', '/:slug');
		expect(route.paramNames).toEqual(['slug']);
		expect(route.staticSegments).toBe(0);
		expect(route.regex.test('/about')).toBe(true);
	});

	it('should escape special regex characters in static segments', () => {
		const route = compileContentRoute('docs', '/docs.v2/:slug');
		expect(route.regex.test('/docs.v2/getting-started')).toBe(true);
		// The dot should be literal, not match any character
		expect(route.regex.test('/docsXv2/getting-started')).toBe(false);
	});
});

describe('compileContentRoutes', () => {
	it('should sort routes by specificity (most static segments first)', () => {
		const routes = compileContentRoutes({
			pages: '/:slug',
			articles: '/articles/:slug',
			categories: '/categories/:slug',
		});

		// articles and categories have 1 static segment, pages has 0
		expect(routes[0].collection).not.toBe('pages');
		expect(routes[routes.length - 1].collection).toBe('pages');
		expect(routes[routes.length - 1].staticSegments).toBe(0);
	});

	it('should return an empty array for empty input', () => {
		const routes = compileContentRoutes({});
		expect(routes).toEqual([]);
	});
});

describe('matchContentRoute', () => {
	const routes = compileContentRoutes({
		articles: '/articles/:slug',
		categories: '/categories/:slug',
		pages: '/:slug',
	});

	it('should match a specific route and extract params', () => {
		const match = matchContentRoute('/articles/my-post', routes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('articles');
		expect(match!.params).toEqual({ slug: 'my-post' });
	});

	it('should match a different specific route', () => {
		const match = matchContentRoute('/categories/tech', routes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('categories');
		expect(match!.params).toEqual({ slug: 'tech' });
	});

	it('should fall back to catch-all for unmatched prefixes', () => {
		const match = matchContentRoute('/about', routes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('pages');
		expect(match!.params).toEqual({ slug: 'about' });
	});

	it('should prefer specific routes over catch-all', () => {
		// /articles/hello could match both /articles/:slug and /:slug
		const match = matchContentRoute('/articles/hello', routes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('articles');
	});

	it('should NOT match paths with extra trailing segments', () => {
		const match = matchContentRoute('/articles/my-post/comments', routes);
		// /articles/my-post/comments has 3 segments — should not match /articles/:slug (2 segments)
		// It also shouldn't match /:slug (1 segment)
		expect(match).toBeUndefined();
	});

	it('should handle trailing slash', () => {
		const match = matchContentRoute('/articles/my-post/', routes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('articles');
		expect(match!.params).toEqual({ slug: 'my-post' });
	});

	it('should return undefined when no routes match', () => {
		const match = matchContentRoute('/api/health', routes);
		// /api/health has 2 segments — could match /articles/:slug pattern
		// but the static segment is 'api' not 'articles'
		expect(match).toBeUndefined();
	});

	it('should return undefined for empty routes array', () => {
		const match = matchContentRoute('/about', []);
		expect(match).toBeUndefined();
	});

	it('should extract multiple params from multi-param patterns', () => {
		const multiRoutes = compileContentRoutes({
			blog: '/blog/:year/:slug',
		});
		const match = matchContentRoute('/blog/2024/my-post', multiRoutes);
		expect(match).toBeDefined();
		expect(match!.collection).toBe('blog');
		expect(match!.params).toEqual({ year: '2024', slug: 'my-post' });
	});

	it('should not match the root path against catch-all', () => {
		// The root path '/' should not produce an empty slug match
		const match = matchContentRoute('/', routes);
		expect(match).toBeUndefined();
	});
});

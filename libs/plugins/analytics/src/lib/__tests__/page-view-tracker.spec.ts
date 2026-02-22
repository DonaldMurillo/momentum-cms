/**
 * Page View Tracker — Unit Tests
 *
 * Tests the pure logic functions used by the Angular PageViewTrackerService.
 * These functions are extracted to be testable without Angular TestBed.
 */

import { describe, it, expect } from 'vitest';
import {
	shouldTrackNavigation,
	buildPageViewEvent,
	DEFAULT_EXCLUDE_PREFIXES,
} from '../page-view-tracker.utils';
import { compileContentRoutes } from '../utils/content-route-matcher';

describe('page-view-tracker', () => {
	describe('shouldTrackNavigation', () => {
		it('should skip the first navigation (SSR-rendered page)', () => {
			expect(shouldTrackNavigation('/about', true, DEFAULT_EXCLUDE_PREFIXES)).toBe(false);
		});

		it('should track subsequent navigations', () => {
			expect(shouldTrackNavigation('/about', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(true);
		});

		it('should exclude /admin paths', () => {
			expect(shouldTrackNavigation('/admin', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(false);
			expect(shouldTrackNavigation('/admin/analytics', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(
				false,
			);
			expect(
				shouldTrackNavigation('/admin/collections/posts', false, DEFAULT_EXCLUDE_PREFIXES),
			).toBe(false);
		});

		it('should exclude /api/ paths', () => {
			expect(shouldTrackNavigation('/api/posts', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(false);
		});

		it('should track normal public pages', () => {
			expect(shouldTrackNavigation('/about', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(true);
			expect(shouldTrackNavigation('/articles/my-post', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(
				true,
			);
			expect(shouldTrackNavigation('/', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(true);
			expect(shouldTrackNavigation('/contact', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(true);
		});

		it('should strip query params before checking exclusions', () => {
			expect(shouldTrackNavigation('/about?ref=home', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(true);
			expect(shouldTrackNavigation('/admin?tab=analytics', false, DEFAULT_EXCLUDE_PREFIXES)).toBe(
				false,
			);
		});

		it('should support custom exclude prefixes', () => {
			const custom = [...DEFAULT_EXCLUDE_PREFIXES, '/private/'];
			expect(shouldTrackNavigation('/private/page', false, custom)).toBe(false);
		});
	});

	describe('buildPageViewEvent', () => {
		const routes = compileContentRoutes({
			articles: '/articles/:slug',
			categories: '/categories/:slug',
			pages: '/:slug',
		});

		it('should build a basic page_view event', () => {
			const event = buildPageViewEvent('/about', undefined);

			expect(event.name).toBe('page_view');
			expect(event.category).toBe('page');
			expect(event.properties['path']).toBe('/about');
			expect(event.properties['collection']).toBeUndefined();
			expect(event.properties['slug']).toBeUndefined();
		});

		it('should match a page content route', () => {
			const event = buildPageViewEvent('/about', routes);

			expect(event.properties['collection']).toBe('pages');
			expect(event.properties['slug']).toBe('about');
		});

		it('should match an article content route', () => {
			const event = buildPageViewEvent('/articles/my-post', routes);

			expect(event.properties['collection']).toBe('articles');
			expect(event.properties['slug']).toBe('my-post');
		});

		it('should match a category content route', () => {
			const event = buildPageViewEvent('/categories/tech', routes);

			expect(event.properties['collection']).toBe('categories');
			expect(event.properties['slug']).toBe('tech');
		});

		it('should strip query params before matching', () => {
			const event = buildPageViewEvent('/articles/my-post?ref=home', routes);

			expect(event.properties['path']).toBe('/articles/my-post');
			expect(event.properties['collection']).toBe('articles');
			expect(event.properties['slug']).toBe('my-post');
		});

		it('should strip fragment before matching', () => {
			const event = buildPageViewEvent('/about#section-1', routes);

			expect(event.properties['path']).toBe('/about');
			expect(event.properties['collection']).toBe('pages');
			expect(event.properties['slug']).toBe('about');
		});

		it('should return no collection for unmatched routes when routes are configured', () => {
			const event = buildPageViewEvent('/', routes);

			// Root path '/' doesn't match '/:slug' (slug is required)
			expect(event.properties['path']).toBe('/');
		});

		it('should handle multi-segment paths that do not match any route', () => {
			const event = buildPageViewEvent('/articles/tech/deep-dive', routes);

			// /articles/tech/deep-dive has too many segments for /articles/:slug
			expect(event.properties['collection']).toBeUndefined();
		});
	});
});

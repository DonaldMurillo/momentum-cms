import { describe, it, expect } from 'vitest';
import { momentumAdminRoutes } from '../../lib/routes/momentum-admin-routes';
import type { CollectionConfig } from '@momentum-cms/core';

describe('momentumAdminRoutes()', () => {
	const mockCollections: CollectionConfig[] = [
		{
			slug: 'posts',
			fields: [{ name: 'title', type: 'text' }],
			labels: { singular: 'Post', plural: 'Posts' },
		},
		{
			slug: 'users',
			fields: [{ name: 'email', type: 'email' }],
			labels: { singular: 'User', plural: 'Users' },
		},
	];

	describe('Basic Route Structure', () => {
		it('should return routes array with base path', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			expect(routes).toBeInstanceOf(Array);
			expect(routes[0].path).toBe('admin');
		});

		it('should strip leading slash from basePath', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			expect(routes[0].path).toBe('admin');
		});

		it('should handle basePath without leading slash', () => {
			const routes = momentumAdminRoutes({
				basePath: 'admin',
				collections: mockCollections,
			});

			expect(routes[0].path).toBe('admin');
		});
	});

	describe('Child Routes', () => {
		it('should include dashboard route as default child', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const children = routes[0].children;
			expect(children).toBeDefined();
			expect(children?.some((c) => c.path === '')).toBe(true);
		});

		it('should include collection list route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const children = routes[0].children;
			expect(children?.some((c) => c.path === 'collections/:slug')).toBe(true);
		});

		it('should include collection create route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const children = routes[0].children;
			expect(children?.some((c) => c.path === 'collections/:slug/create')).toBe(true);
		});

		it('should include collection edit route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const children = routes[0].children;
			expect(children?.some((c) => c.path === 'collections/:slug/:id')).toBe(true);
		});
	});

	describe('Route Data', () => {
		it('should pass collections to route data', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const routeData = routes[0].data;
			expect(routeData?.collections).toBe(mockCollections);
		});

		it('should pass branding to route data when provided', () => {
			const branding = {
				logo: '/logo.svg',
				title: 'My CMS',
			};

			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
				branding,
			});

			const routeData = routes[0].data;
			expect(routeData?.branding).toBe(branding);
		});
	});

	describe('Lazy Loading', () => {
		it('should use loadComponent for shell component', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			expect(routes[0].loadComponent).toBeDefined();
			expect(typeof routes[0].loadComponent).toBe('function');
		});

		it('should use loadComponent for child routes', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const children = routes[0].children;
			const dashboardRoute = children?.find((c) => c.path === '');
			expect(dashboardRoute?.loadComponent).toBeDefined();
		});
	});

	describe('Empty Collections', () => {
		it('should work with empty collections array', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [],
			});

			expect(routes).toBeInstanceOf(Array);
			expect(routes[0].path).toBe('admin');
		});
	});
});

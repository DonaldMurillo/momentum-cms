import '@angular/compiler';
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

	// Helper to find the admin shell route (the one with children)
	const findAdminShellRoute = (
		routes: ReturnType<typeof momentumAdminRoutes>,
	): ReturnType<typeof momentumAdminRoutes>[0] | undefined => {
		return routes.find((r) => r.children !== undefined);
	};

	describe('Basic Route Structure', () => {
		it('should return routes array with admin shell route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			expect(routes).toBeInstanceOf(Array);
			const adminRoute = findAdminShellRoute(routes);
			expect(adminRoute).toBeDefined();
			expect(adminRoute?.path).toBe('admin');
		});

		it('should strip leading slash from basePath', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			expect(adminRoute?.path).toBe('admin');
		});

		it('should handle basePath without leading slash', () => {
			const routes = momentumAdminRoutes({
				basePath: 'admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			expect(adminRoute?.path).toBe('admin');
		});

		it('should include auth routes by default', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			expect(routes.some((r) => r.path === 'admin/login')).toBe(true);
			expect(routes.some((r) => r.path === 'admin/setup')).toBe(true);
		});

		it('should exclude auth routes when includeAuthRoutes is false', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
				includeAuthRoutes: false,
			});

			expect(routes.some((r) => r.path === 'admin/login')).toBe(false);
			expect(routes.some((r) => r.path === 'admin/setup')).toBe(false);
		});
	});

	describe('Child Routes', () => {
		it('should include dashboard route as default child', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
			expect(children).toBeDefined();
			expect(children?.some((c) => c.path === '')).toBe(true);
		});

		it('should include collection list route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
			expect(children?.some((c) => c.path === 'collections/:slug')).toBe(true);
		});

		it('should include collection create route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
			expect(children?.some((c) => c.path === 'collections/:slug/new')).toBe(true);
		});

		it('should include collection view route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
			expect(children?.some((c) => c.path === 'collections/:slug/:id')).toBe(true);
		});

		it('should include collection edit route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
			expect(children?.some((c) => c.path === 'collections/:slug/:id/edit')).toBe(true);
		});
	});

	describe('Route Data', () => {
		it('should pass collections to route data', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const routeData = adminRoute?.data;
			expect(routeData?.['collections']).toBe(mockCollections);
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

			const adminRoute = findAdminShellRoute(routes);
			const routeData = adminRoute?.data;
			expect(routeData?.['branding']).toBe(branding);
		});
	});

	describe('Lazy Loading', () => {
		it('should use loadComponent for shell component', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			expect(adminRoute?.loadComponent).toBeDefined();
			expect(typeof adminRoute?.loadComponent).toBe('function');
		});

		it('should use loadComponent for child routes', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: mockCollections,
			});

			const adminRoute = findAdminShellRoute(routes);
			const children = adminRoute?.children;
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
			const adminRoute = findAdminShellRoute(routes);
			expect(adminRoute).toBeDefined();
			expect(adminRoute?.path).toBe('admin');
		});
	});
});

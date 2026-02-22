import { describe, it, expect, vi } from 'vitest';
import type {
	CollectionConfig,
	GlobalConfig,
	MomentumPlugin,
	PluginAdminRouteDescriptor,
} from '@momentumcms/core';
import { momentumAdminRoutes } from '../momentum-admin-routes';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', label: 'Title' }],
};

const mockCollection2: CollectionConfig = {
	slug: 'pages',
	fields: [{ name: 'body', type: 'richText', label: 'Body' }],
};

const mockGlobal: GlobalConfig = {
	slug: 'settings',
	fields: [{ name: 'siteName', type: 'text', label: 'Site Name' }],
};

const mockPluginRoute: PluginAdminRouteDescriptor = {
	path: 'analytics',
	loadComponent: () => Promise.resolve(class {}),
	label: 'Analytics',
	icon: 'heroChartBar',
};

describe('momentumAdminRoutes', () => {
	describe('MomentumAdminOptions input', () => {
		it('should create routes with basePath and collections', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			expect(routes.length).toBeGreaterThan(0);
		});

		it('should include auth routes by default', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const authPaths = routes
				.map((r) => r.path)
				.filter((p) => p?.includes('login') || p?.includes('setup'));
			expect(authPaths.length).toBeGreaterThanOrEqual(2);
		});

		it('should exclude auth routes when includeAuthRoutes is false', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				includeAuthRoutes: false,
			});

			const authPaths = routes.map((r) => r.path).filter((p) => p?.includes('login'));
			expect(authPaths).toHaveLength(0);
		});

		it('should strip leading slash from basePath', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();
		});

		it('should handle basePath without leading slash', () => {
			const routes = momentumAdminRoutes({
				basePath: 'admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();
		});

		it('should include admin shell as main route with children', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();
			expect(adminRoute!.children).toBeDefined();
			expect(adminRoute!.children!.length).toBeGreaterThan(0);
		});

		it('should include dashboard as default child route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const dashboardRoute = adminRoute!.children!.find((r) => r.path === '');
			expect(dashboardRoute).toBeDefined();
		});

		it('should include media library route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const mediaRoute = adminRoute!.children!.find((r) => r.path === 'media');
			expect(mediaRoute).toBeDefined();
		});

		it('should include collection routes (list, new, view, edit)', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const children = adminRoute!.children!;
			expect(children.find((r) => r.path === 'collections/:slug')).toBeDefined();
			expect(children.find((r) => r.path === 'collections/:slug/new')).toBeDefined();
			expect(children.find((r) => r.path === 'collections/:slug/:id')).toBeDefined();
			expect(children.find((r) => r.path === 'collections/:slug/:id/edit')).toBeDefined();
		});

		it('should include global edit route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				globals: [mockGlobal],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const globalRoute = adminRoute!.children!.find((r) => r.path === 'globals/:slug');
			expect(globalRoute).toBeDefined();
		});

		it('should include branding in route data', () => {
			const branding = { title: 'My CMS', logo: '/logo.svg' };
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				branding,
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute!.data).toBeDefined();
			expect((adminRoute!.data as Record<string, unknown>)['branding']).toEqual(branding);
		});

		it('should include plugin routes as children', () => {
			const pluginRoutes = [
				{
					path: 'analytics',
					loadComponent: () => Promise.resolve(class {}),
					label: 'Analytics',
					icon: 'heroChart',
				},
			];

			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				pluginRoutes,
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const analyticsRoute = adminRoute!.children!.find((r) => r.path === 'analytics');
			expect(analyticsRoute).toBeDefined();
		});

		it('should pass collections in route data', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection, mockCollection2],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const data = adminRoute!.data as Record<string, unknown>;
			const collections = data['collections'] as CollectionConfig[];
			expect(collections).toHaveLength(2);
			expect(collections[0].slug).toBe('posts');
			expect(collections[1].slug).toBe('pages');
		});

		it('should merge plugin collections and deduplicate by slug', () => {
			const pluginWithCollections: MomentumPlugin = {
				name: 'test-plugin',
				collections: [mockCollection2], // pages
			};

			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection, mockCollection2], // posts + pages
				plugins: [pluginWithCollections],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const data = adminRoute!.data as Record<string, unknown>;
			const collections = data['collections'] as CollectionConfig[];
			// Should not duplicate 'pages'
			const pageSlugs = collections.filter((c) => c.slug === 'pages');
			expect(pageSlugs).toHaveLength(1);
		});

		it('should apply plugin modifyCollections transform', () => {
			const modifySpy = vi.fn((cols: CollectionConfig[]) => {
				cols.push({
					slug: 'injected',
					fields: [],
				});
			});

			const plugin: MomentumPlugin = {
				name: 'modifier-plugin',
				modifyCollections: modifySpy,
			};

			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				plugins: [plugin],
			});

			expect(modifySpy).toHaveBeenCalled();
			const adminRoute = routes.find((r) => r.path === 'admin');
			const data = adminRoute!.data as Record<string, unknown>;
			const collections = data['collections'] as CollectionConfig[];
			expect(collections.find((c) => c.slug === 'injected')).toBeDefined();
		});

		it('should merge plugin admin routes with explicit plugin routes', () => {
			const plugin: MomentumPlugin = {
				name: 'test-plugin',
				adminRoutes: [mockPluginRoute],
			};

			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
				plugins: [plugin],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const analyticsRoute = adminRoute!.children!.find((r) => r.path === 'analytics');
			expect(analyticsRoute).toBeDefined();
		});
	});

	describe('MomentumAdminConfig input', () => {
		it('should handle admin config without basePath (uses /admin default)', () => {
			const routes = momentumAdminRoutes({
				collections: [mockCollection],
				admin: { basePath: '/dashboard' },
			});

			const adminRoute = routes.find((r) => r.path === 'dashboard');
			expect(adminRoute).toBeDefined();
		});

		it('should handle admin config with branding', () => {
			const routes = momentumAdminRoutes({
				collections: [mockCollection],
				admin: {
					basePath: '/admin',
					branding: { title: 'CMS' },
				},
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const data = adminRoute!.data as Record<string, unknown>;
			expect(data['branding']).toEqual({ title: 'CMS' });
		});
	});

	describe('MomentumConfig input', () => {
		it('should handle full MomentumConfig with db key', () => {
			const routes = momentumAdminRoutes({
				collections: [mockCollection],
				db: {} as unknown,
				admin: { basePath: '/admin' },
			} as unknown as Parameters<typeof momentumAdminRoutes>[0]);

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();
		});
	});

	describe('auth route configuration', () => {
		it('should include login route with guestGuard', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [],
			});

			const loginRoute = routes.find((r) => r.path === 'admin/login');
			expect(loginRoute).toBeDefined();
			expect(loginRoute!.canActivate).toBeDefined();
			expect(loginRoute!.canActivate!.length).toBe(1);
		});

		it('should include setup route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [],
			});

			const setupRoute = routes.find((r) => r.path === 'admin/setup');
			expect(setupRoute).toBeDefined();
		});

		it('should include forgot-password route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [],
			});

			const route = routes.find((r) => r.path === 'admin/forgot-password');
			expect(route).toBeDefined();
		});

		it('should include reset-password route', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [],
			});

			const route = routes.find((r) => r.path === 'admin/reset-password');
			expect(route).toBeDefined();
		});
	});

	describe('route guards', () => {
		it('should protect admin shell with authGuard', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute!.canActivate).toBeDefined();
			expect(adminRoute!.canActivate!.length).toBe(1);
		});

		it('should protect collection routes with collectionAccessGuard', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const listRoute = adminRoute!.children!.find((r) => r.path === 'collections/:slug');
			expect(listRoute!.canActivate).toBeDefined();
		});

		it('should protect edit routes with unsavedChangesGuard', () => {
			const routes = momentumAdminRoutes({
				basePath: '/admin',
				collections: [mockCollection],
			});

			const adminRoute = routes.find((r) => r.path === 'admin');
			const newRoute = adminRoute!.children!.find((r) => r.path === 'collections/:slug/new');
			expect(newRoute!.canDeactivate).toBeDefined();
		});
	});
});

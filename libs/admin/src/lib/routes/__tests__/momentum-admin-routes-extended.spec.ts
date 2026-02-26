/**
 * Extended coverage tests for momentumAdminRoutes.
 *
 * Targets uncovered branches in the MomentumConfig and MomentumAdminConfig
 * code paths, specifically:
 * - MomentumConfig: plugin collection merging, plugin admin routes, globals, branding
 * - MomentumAdminConfig: plugin collection merging, plugin admin routes
 * - modifyCollections within MomentumConfig and MomentumAdminConfig branches
 */
import { describe, it, expect, vi } from 'vitest';
import type {
	CollectionConfig,
	GlobalConfig,
	MomentumConfig,
	MomentumAdminConfig,
	MomentumPlugin,
} from '@momentumcms/core';
import { momentumAdminRoutes, type MomentumAdminRouteData } from '../momentum-admin-routes';

const postsCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', label: 'Title' }],
};

const pagesCollection: CollectionConfig = {
	slug: 'pages',
	fields: [{ name: 'body', type: 'richText', label: 'Body' }],
};

const settingsGlobal: GlobalConfig = {
	slug: 'settings',
	fields: [{ name: 'siteName', type: 'text', label: 'Site Name' }],
};

describe('momentumAdminRoutes - extended coverage', () => {
	// -------------------------------------------------------------------
	// MomentumConfig branch (lines 139–154): 'db' in configOrOptions
	// -------------------------------------------------------------------
	describe('MomentumConfig branch — plugin collection/route merging', () => {
		it('should merge plugin collections and deduplicate by slug', () => {
			const plugin: MomentumPlugin = {
				name: 'auth-plugin',
				collections: [pagesCollection],
			};

			const config = {
				db: {},
				collections: [postsCollection, pagesCollection],
				globals: [settingsGlobal],
				admin: { basePath: '/admin', branding: { title: 'Test CMS' } },
				plugins: [plugin],
			} as unknown as MomentumConfig;

			const routes = momentumAdminRoutes(config);
			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();

			const data = adminRoute?.data as MomentumAdminRouteData;
			// 'pages' from plugin should be deduped
			const pageSlugs = data.collections.filter((c) => c.slug === 'pages');
			expect(pageSlugs).toHaveLength(1);
			// globals passed through
			expect(data.globals).toEqual([settingsGlobal]);
			// branding passed through
			expect(data.branding).toEqual({ title: 'Test CMS' });
		});

		it('should convert plugin adminRoutes to child routes', () => {
			const plugin: MomentumPlugin = {
				name: 'analytics-plugin',
				adminRoutes: [
					{
						path: 'analytics',
						loadComponent: () => Promise.resolve(class {}),
						label: 'Analytics',
						icon: 'heroChartBar',
						group: 'Plugins',
					},
				],
			};

			const config = {
				db: {},
				collections: [postsCollection],
				plugins: [plugin],
			} as unknown as MomentumConfig;

			const routes = momentumAdminRoutes(config);
			const adminRoute = routes.find((r) => r.path === 'admin');
			const analyticsChild = adminRoute?.children?.find((r) => r.path === 'analytics');
			expect(analyticsChild).toBeDefined();

			// pluginRoutes in data should include the converted route
			const data = adminRoute?.data as MomentumAdminRouteData;
			expect(data.pluginRoutes).toBeDefined();
			expect(data.pluginRoutes?.length).toBe(1);
			expect(data.pluginRoutes?.[0].label).toBe('Analytics');
		});

		it('should call modifyCollections on plugins', () => {
			const modifySpy = vi.fn();
			const plugin: MomentumPlugin = {
				name: 'modifier',
				modifyCollections: modifySpy,
			};

			const config = {
				db: {},
				collections: [postsCollection],
				plugins: [plugin],
			} as unknown as MomentumConfig;

			momentumAdminRoutes(config);
			expect(modifySpy).toHaveBeenCalledWith(expect.arrayContaining([postsCollection]));
		});
	});

	// -------------------------------------------------------------------
	// MomentumAdminConfig branch (lines 176–192): else (no db, no basePath)
	// -------------------------------------------------------------------
	describe('MomentumAdminConfig branch — plugin collection/route merging', () => {
		it('should merge plugin collections and deduplicate by slug', () => {
			const plugin: MomentumPlugin = {
				name: 'auth-plugin',
				collections: [pagesCollection],
			};

			const adminConfig: MomentumAdminConfig = {
				collections: [postsCollection, pagesCollection],
				globals: [settingsGlobal],
				admin: { basePath: '/cms', branding: { logo: '/logo.png' } },
				plugins: [plugin],
			};

			const routes = momentumAdminRoutes(adminConfig);
			const adminRoute = routes.find((r) => r.path === 'cms');
			expect(adminRoute).toBeDefined();

			const data = adminRoute?.data as MomentumAdminRouteData;
			const pageSlugs = data.collections.filter((c) => c.slug === 'pages');
			expect(pageSlugs).toHaveLength(1);
			expect(data.globals).toEqual([settingsGlobal]);
			expect(data.branding).toEqual({ logo: '/logo.png' });
		});

		it('should convert plugin adminRoutes to child routes', () => {
			const plugin: MomentumPlugin = {
				name: 'seo-plugin',
				adminRoutes: [
					{
						path: 'seo',
						loadComponent: () => Promise.resolve(class {}),
						label: 'SEO',
						icon: 'heroGlobeAlt',
						data: { custom: true },
					},
				],
			};

			const adminConfig: MomentumAdminConfig = {
				collections: [postsCollection],
				plugins: [plugin],
			};

			const routes = momentumAdminRoutes(adminConfig);
			const adminRoute = routes.find((r) => r.path === 'admin');
			const seoChild = adminRoute?.children?.find((r) => r.path === 'seo');
			expect(seoChild).toBeDefined();

			const data = adminRoute?.data as MomentumAdminRouteData;
			expect(data.pluginRoutes).toBeDefined();
			expect(data.pluginRoutes?.[0].label).toBe('SEO');
			expect(data.pluginRoutes?.[0].data).toEqual({ custom: true });
		});

		it('should call modifyCollections on plugins', () => {
			const modifySpy = vi.fn();
			const plugin: MomentumPlugin = {
				name: 'field-injector',
				modifyCollections: modifySpy,
			};

			const adminConfig: MomentumAdminConfig = {
				collections: [postsCollection],
				plugins: [plugin],
			};

			momentumAdminRoutes(adminConfig);
			expect(modifySpy).toHaveBeenCalledWith(expect.arrayContaining([postsCollection]));
		});

		it('should default basePath to /admin when admin.basePath is not set', () => {
			const adminConfig: MomentumAdminConfig = {
				collections: [postsCollection],
			};

			const routes = momentumAdminRoutes(adminConfig);
			const adminRoute = routes.find((r) => r.path === 'admin');
			expect(adminRoute).toBeDefined();
		});

		it('should add unique plugin collections not already in config', () => {
			const usersCollection: CollectionConfig = {
				slug: 'users',
				fields: [{ name: 'email', type: 'text', label: 'Email' }],
			};

			const plugin: MomentumPlugin = {
				name: 'auth-plugin',
				collections: [usersCollection],
			};

			const adminConfig: MomentumAdminConfig = {
				collections: [postsCollection],
				plugins: [plugin],
			};

			const routes = momentumAdminRoutes(adminConfig);
			const adminRoute = routes.find((r) => r.path === 'admin');
			const data = adminRoute?.data as MomentumAdminRouteData;
			expect(data.collections).toHaveLength(2);
			expect(data.collections.find((c) => c.slug === 'users')).toBeDefined();
		});
	});
});

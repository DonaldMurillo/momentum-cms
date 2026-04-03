/**
 * Default cache admin route descriptors.
 *
 * Browser-safe: no server-side dependencies (Express, ioredis, etc.).
 * This file is the entry point for `@momentumcms/plugins-cache/admin-routes`.
 */
import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Default cache admin dashboard route.
 * Lazily loads the built-in dashboard component.
 */
export const cacheAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'cache',
		label: 'Cache',
		icon: 'heroBolt',
		loadComponent: (): Promise<unknown> =>
			import('./admin/cache-dashboard.page').then((m) => m.CacheDashboardPage),
		group: 'System',
	},
];

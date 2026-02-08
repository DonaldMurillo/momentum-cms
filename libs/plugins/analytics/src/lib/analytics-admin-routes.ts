/**
 * Default analytics admin route descriptors.
 *
 * Browser-safe: no server-side dependencies (Express, pg, etc.).
 * This file is the entry point for `@momentum-cms/plugins/analytics/admin-routes`.
 *
 * Used by:
 * - Angular app routing (browser build)
 * - Analytics plugin factory (server build, as defaults)
 */
import type { PluginAdminRouteDescriptor } from '@momentum-cms/core';

/**
 * Default analytics admin dashboard route.
 * Lazily loads the built-in dashboard component.
 */
export const analyticsAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'analytics',
		label: 'Analytics',
		icon: 'heroChartBarSquare',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/analytics-dashboard.page').then((m) => m.AnalyticsDashboardPage),
		group: 'Tools',
	},
];

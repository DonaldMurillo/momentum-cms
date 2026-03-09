/**
 * Default OTel admin route descriptors.
 *
 * Browser-safe: no server-side dependencies (Express, OTel SDK, etc.).
 * This file is the entry point for `@momentumcms/plugins-otel/admin-routes`.
 *
 * Used by:
 * - Angular app routing (browser build)
 * - OTel plugin factory (server build, as defaults)
 */
import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Default observability admin dashboard route.
 * Lazily loads the built-in dashboard component.
 */
export const otelAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'observability',
		label: 'Observability',
		icon: 'heroSignal',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/otel-dashboard.page').then((m) => m.OtelDashboardPage),
		group: 'Plugins',
	},
];

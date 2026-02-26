import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Browser-safe admin route descriptors for the cron plugin.
 * Used by the admin config generator.
 */
export const cronAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'cron',
		label: 'Cron Schedules',
		icon: 'heroClock',
		loadComponent: () =>
			Promise.resolve({
				/* Placeholder — admin UI component will be implemented later */
			}),
		group: 'System',
	},
];

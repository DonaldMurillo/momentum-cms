import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Browser-safe admin route descriptors for the queue plugin.
 * Used by the admin config generator.
 */
export const queueAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'queue',
		label: 'Job Queue',
		icon: 'heroQueueList',
		loadComponent: () =>
			Promise.resolve({
				/* Placeholder — admin UI component will be implemented later */
			}),
		group: 'System',
	},
];

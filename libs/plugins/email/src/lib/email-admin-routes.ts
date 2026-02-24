/**
 * Browser-safe admin route descriptors for the email plugin.
 *
 * Imported by the admin config generator via `browserImports.adminRoutes`.
 * This file must NOT import any server-only dependencies.
 */
import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

export const emailAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'email-playground',
		label: 'Email Playground',
		icon: 'heroEnvelopeOpen',
		loadComponent: (): Promise<unknown> =>
			import('@momentumcms/email-builder').then((m) => m.EmailBuilderStudioPage),
		group: 'Tools',
	},
];

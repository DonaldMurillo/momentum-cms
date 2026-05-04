/**
 * Email Builder admin route descriptors.
 *
 * Browser-safe: no server-side dependencies.
 * Provides a single admin page for the visual email builder studio.
 */
import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

export const emailBuilderAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'email-builder',
		label: 'Email Builder',
		// Distinct from `email-templates` (heroEnvelopeOpen) — this is the *composer* tool,
		// not the templates collection.
		icon: 'heroPaintBrush',
		loadComponent: (): Promise<unknown> =>
			import('./email-builder-studio.page').then((m) => m.EmailBuilderStudioPage),
		group: 'Tools',
	},
];

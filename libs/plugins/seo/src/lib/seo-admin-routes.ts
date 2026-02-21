/**
 * SEO Admin Routes (browser-safe)
 *
 * Exported for the admin config generator via
 * `@momentumcms/plugins/seo/admin-routes`.
 * Does NOT contain server-side imports.
 */

import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Browser-safe admin route descriptors for the SEO plugin.
 */
export const seoAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'seo',
		label: 'SEO',
		icon: 'heroMagnifyingGlass',
		group: 'SEO',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/seo-dashboard.page').then(
				(m: Record<string, unknown>) => m['SeoDashboardPage'],
			),
	},
	{
		path: 'seo/sitemap',
		label: 'Sitemap',
		icon: 'heroMap',
		group: 'SEO',
		loadComponent: (): Promise<unknown> =>
			import('./sitemap/sitemap-settings.page').then(
				(m: Record<string, unknown>) => m['SitemapSettingsPage'],
			),
	},
	{
		path: 'seo/robots',
		label: 'Robots',
		icon: 'heroDocumentText',
		group: 'SEO',
		loadComponent: (): Promise<unknown> =>
			import('./robots/robots-settings.page').then(
				(m: Record<string, unknown>) => m['RobotsSettingsPage'],
			),
	},
];

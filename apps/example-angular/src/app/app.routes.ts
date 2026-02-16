import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { KitchenSinkPage } from '@momentumcms/ui';
// eslint-disable-next-line @nx/enforce-module-boundaries -- admin routes are eagerly loaded, not the full plugin
import { analyticsAdminRoutes } from '@momentumcms/plugins/analytics/admin-routes';
// eslint-disable-next-line @nx/enforce-module-boundaries -- browser-safe block field injector
import { injectBlockAnalyticsFields } from '@momentumcms/plugins/analytics/block-fields';
import { BASE_AUTH_COLLECTIONS } from '@momentumcms/auth/collections';
// eslint-disable-next-line @nx/enforce-module-boundaries -- config is also lazy-loaded for page components
import { collections } from '@momentumcms/example-config/collections';
// eslint-disable-next-line @nx/enforce-module-boundaries -- config is also lazy-loaded for page components
import { globals } from '@momentumcms/example-config/globals';
// eslint-disable-next-line @nx/enforce-module-boundaries -- resolver must be static, page components are lazy-loaded
import { pageResolver } from '@momentumcms/example-config/pages';

// Merge all collections for admin routes, then inject analytics block fields
const adminCollections = [...collections, ...BASE_AUTH_COLLECTIONS];
injectBlockAnalyticsFields(adminCollections);

export const appRoutes: Route[] = [
	// Home page (renders the page with slug 'home')
	{
		path: '',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
		pathMatch: 'full',
		data: { slug: 'home' },
		resolve: { pageData: pageResolver },
	},
	// Experiments page
	{
		path: 'experiments',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.ExperimentsPage),
	},
	// Kitchen Sink - UI component showcase
	{
		path: 'kitchen-sink',
		component: KitchenSinkPage,
	},
	// Mount admin UI at /admin (before :slug catch-all)
	...momentumAdminRoutes({
		basePath: '/admin',
		collections: adminCollections,
		globals,
		branding: {
			title: 'Momentum CMS',
		},
		pluginRoutes: analyticsAdminRoutes,
	}),
	// Dynamic page rendering by slug
	{
		path: ':slug',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
		resolve: { pageData: pageResolver },
	},
];

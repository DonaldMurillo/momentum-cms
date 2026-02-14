import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { KitchenSinkPage } from '@momentum-cms/ui';
// eslint-disable-next-line @nx/enforce-module-boundaries -- admin routes are eagerly loaded, not the full plugin
import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';
// eslint-disable-next-line @nx/enforce-module-boundaries -- browser-safe block field injector
import { injectBlockAnalyticsFields } from '@momentum-cms/plugins/analytics/block-fields';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';
import { collections } from '@momentum-cms/example-config/collections';
import { globals } from '@momentum-cms/example-config/globals';
import { pageResolver } from './pages/page.resolver';

// Merge all collections for admin routes, then inject analytics block fields
const adminCollections = [...collections, ...BASE_AUTH_COLLECTIONS];
injectBlockAnalyticsFields(adminCollections);

export const appRoutes: Route[] = [
	// Home page (renders the page with slug 'home')
	{
		path: '',
		loadComponent: () => import('./pages/page.component').then((m) => m.PageComponent),
		pathMatch: 'full',
		data: { slug: 'home' },
		resolve: { pageData: pageResolver },
	},
	// Experiments page
	{
		path: 'experiments',
		loadComponent: () =>
			import('./pages/experiments/experiments.page').then((m) => m.ExperimentsPage),
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
		loadComponent: () => import('./pages/page.component').then((m) => m.PageComponent),
		resolve: { pageData: pageResolver },
	},
];

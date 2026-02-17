import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { KitchenSinkPage } from '@momentumcms/ui';
import { pageResolver } from '@momentumcms/example-config/pages';
import { adminConfig } from '../generated/momentum.config';

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
	...momentumAdminRoutes(adminConfig),
	// Dynamic page rendering by slug
	{
		path: ':slug',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
		resolve: { pageData: pageResolver },
	},
];

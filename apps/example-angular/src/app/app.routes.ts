import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { KitchenSinkPage } from '@momentum-cms/ui';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';
import { collections } from '../collections';
import { globals } from '../globals';

export const appRoutes: Route[] = [
	// Landing page
	{
		path: '',
		loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
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
	// Mount admin UI at /admin
	...momentumAdminRoutes({
		basePath: '/admin',
		collections: [...collections, ...BASE_AUTH_COLLECTIONS],
		globals,
		branding: {
			title: 'Momentum CMS',
		},
	}),
];

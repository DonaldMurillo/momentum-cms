import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { collections } from '../collections';

export const appRoutes: Route[] = [
	// Landing page
	{
		path: '',
		loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
	},
	// Landing page
	{
		path: 'experiments',
		loadComponent: () =>
			import('./pages/experiments/experiments.page').then((m) => m.ExperimentsPage),
	},
	// Mount admin UI at /admin
	...momentumAdminRoutes({
		basePath: '/admin',
		collections,
		branding: {
			title: 'Momentum CMS',
		},
	}),
];

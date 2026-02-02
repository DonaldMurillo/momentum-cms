import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { collections } from '../collections';

export const appRoutes: Route[] = [
	// Landing page
	{
		path: '',
		loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
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

import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';
import { collections } from '../collections';

export const appRoutes: Route[] = [
	// Home page (renders the page with slug 'home')
	{
		path: '',
		loadComponent: () => import('./pages/page.component').then((m) => m.PageComponent),
		pathMatch: 'full',
		data: { slug: 'home' },
	},
	// Mount admin UI at /admin (before :slug catch-all)
	...momentumAdminRoutes({
		basePath: '/admin',
		collections,
		branding: {
			title: 'Seeding Test App',
		},
		pluginRoutes: analyticsAdminRoutes,
	}),
	// Dynamic page rendering by slug
	{
		path: ':slug',
		loadComponent: () => import('./pages/page.component').then((m) => m.PageComponent),
	},
];

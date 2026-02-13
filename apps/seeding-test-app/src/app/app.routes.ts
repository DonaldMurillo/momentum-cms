import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
// eslint-disable-next-line @nx/enforce-module-boundaries -- admin routes are eagerly loaded, not the full plugin
import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';
import { collections } from '../collections';
import { globals } from '../globals';

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
		collections: [...collections, ...BASE_AUTH_COLLECTIONS],
		globals,
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

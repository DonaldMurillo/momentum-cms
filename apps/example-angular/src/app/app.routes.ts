import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { KitchenSinkPage } from '@momentumcms/ui';
import { pageResolver } from '@momentumcms/example-config/pages';
import { adminConfig } from '../generated/momentum.config';

export const appRoutes: Route[] = [
	// Mount admin UI at /admin (own shell, no layout wrapper)
	...momentumAdminRoutes(adminConfig),
	// Public pages wrapped in app layout (header + footer)
	{
		path: '',
		loadComponent: () =>
			import('@momentumcms/example-config/pages').then((m) => m.AppLayoutComponent),
		children: [
			// Home page (renders the page with slug 'home')
			{
				path: '',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
				pathMatch: 'full',
				data: { slug: 'home' },
				resolve: { pageData: pageResolver },
			},
			// Articles listing page
			{
				path: 'articles',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.ArticlesPageComponent),
			},
			// Experiments page
			{
				path: 'experiments',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.ExperimentsPage),
			},
			// Kitchen Sink - UI component showcase
			{
				path: 'kitchen-sink',
				component: KitchenSinkPage,
			},
			// Dynamic page rendering by slug (catch-all for public pages)
			{
				path: ':slug',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
				resolve: { pageData: pageResolver },
			},
		],
	},
];

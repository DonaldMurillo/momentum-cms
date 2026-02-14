import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
// eslint-disable-next-line @nx/enforce-module-boundaries -- admin routes are eagerly loaded, not the full plugin
import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';
// eslint-disable-next-line @nx/enforce-module-boundaries -- browser-safe block field injector
import { injectBlockAnalyticsFields } from '@momentum-cms/plugins/analytics/block-fields';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';
import { collections } from '../collections';
import { globals } from '../globals';

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
	},
	// Mount admin UI at /admin (before :slug catch-all)
	...momentumAdminRoutes({
		basePath: '/admin',
		collections: adminCollections,
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

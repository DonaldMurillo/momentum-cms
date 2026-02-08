import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';
import { collections } from '../collections';

export const appRoutes: Route[] = [
	// Redirect root to admin
	{
		path: '',
		redirectTo: 'admin',
		pathMatch: 'full',
	},
	// Mount admin UI at /admin
	// Plugin admin routes are imported directly from each plugin's browser-safe export
	...momentumAdminRoutes({
		basePath: '/admin',
		collections,
		branding: {
			title: 'Seeding Test App',
		},
		pluginRoutes: analyticsAdminRoutes,
	}),
];

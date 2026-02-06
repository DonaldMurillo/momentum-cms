import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { collections } from '../collections';

export const appRoutes: Route[] = [
	// Redirect root to admin
	{
		path: '',
		redirectTo: 'admin',
		pathMatch: 'full',
	},
	// Mount admin UI at /admin
	...momentumAdminRoutes({
		basePath: '/admin',
		collections,
		branding: {
			title: 'Seeding Test App',
		},
	}),
];

import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';

export const routes: Route[] = [
	{
		path: '',
		loadComponent: () => import('./pages/welcome').then((m) => m.WelcomePage),
	},
	...momentumAdminRoutes(adminConfig),
];

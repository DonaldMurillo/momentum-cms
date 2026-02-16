import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { Posts } from '../collections/posts';

export const routes: Route[] = [
	{
		path: '',
		loadComponent: () => import('./pages/welcome').then((m) => m.WelcomePage),
	},
	...momentumAdminRoutes({
		basePath: '/admin',
		collections: [Posts],
		branding: { title: 'Momentum CMS' },
	}),
];

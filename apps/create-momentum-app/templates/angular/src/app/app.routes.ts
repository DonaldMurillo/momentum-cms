import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';

export const routes: Route[] = [
	{
		path: '',
		loadComponent: () => import('./pages/welcome').then((m) => m.WelcomePage),
	},
	{
		path: 'posts',
		loadComponent: () => import('./pages/posts').then((m) => m.PostsPageComponent),
	},
	{
		path: 'posts/:slug',
		loadComponent: () => import('./pages/post-detail').then((m) => m.PostDetailComponent),
		resolve: {
			postData: () => import('./pages/post-detail.resolver').then((m) => m.postDetailResolver),
		},
	},
	...momentumAdminRoutes(adminConfig),
];

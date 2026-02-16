import { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { Posts } from '../collections/posts';

export const routes: Route[] = [
	{ path: '', redirectTo: '/admin', pathMatch: 'full' },
	...momentumAdminRoutes({
		basePath: '/admin',
		collections: [Posts],
		branding: { title: 'Momentum CMS' },
	}),
];

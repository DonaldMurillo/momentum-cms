import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import type { Routes } from '@angular/router';
import { momentumAdminRoutes, crudToastInterceptor } from '@momentum-cms/admin';

import { collections } from '@momentum-cms/example-config/collections';

import { globals } from '@momentum-cms/example-config/globals';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';

import { providePageBlocks, pageResolver } from '@momentum-cms/example-config/pages';

// Page routes — defined explicitly so the PageComponent receives route params directly
// (Analog's file-based routing wraps components in loadChildren, which can interfere with param inheritance)
const pageRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('@momentum-cms/example-config/pages').then((m) => m.PageComponent),
		data: { slug: 'home' },
		resolve: { pageData: pageResolver },
	},
	{
		path: ':slug',
		loadComponent: () => import('@momentum-cms/example-config/pages').then((m) => m.PageComponent),
		resolve: { pageData: pageResolver },
	},
];

// Admin routes configuration
const adminRoutes = momentumAdminRoutes({
	basePath: '/admin',
	collections: [...collections, ...BASE_AUTH_COLLECTIONS],
	globals,
	branding: {
		title: 'Momentum CMS',
	},
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),

		provideFileRouter(withExtraRoutes([...adminRoutes, ...pageRoutes])),
		provideClientHydration(),
		provideHttpClient(
			withFetch(),
			withInterceptors([requestContextInterceptor, crudToastInterceptor]),
		),
		...providePageBlocks(),
	],
};

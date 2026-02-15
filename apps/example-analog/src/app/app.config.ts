import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import type { Routes } from '@angular/router';
import { momentumAdminRoutes, crudToastInterceptor } from '@momentum-cms/admin';

import { collections } from '@momentum-cms/example-config/collections';

import { globals } from '@momentum-cms/example-config/globals';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth/collections';

import { analyticsAdminRoutes } from '@momentum-cms/plugins/analytics/admin-routes';

import { injectBlockAnalyticsFields } from '@momentum-cms/plugins/analytics/block-fields';

import { providePageBlocks, pageResolver } from '@momentum-cms/example-config/pages';

// Merge all collections for admin routes, then inject analytics block fields
const adminCollections = [...collections, ...BASE_AUTH_COLLECTIONS];
injectBlockAnalyticsFields(adminCollections);

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
	// Experiments page (must be before :slug catch-all)
	{
		path: 'experiments',
		loadComponent: () =>
			import('@momentum-cms/example-config/pages').then((m) => m.ExperimentsPage),
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
	collections: adminCollections,
	globals,
	branding: {
		title: 'Momentum CMS',
	},
	pluginRoutes: analyticsAdminRoutes,
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),

		provideFileRouter(withExtraRoutes([...adminRoutes, ...pageRoutes])),
		provideClientHydration(),
		provideHttpClient(
			withFetch(),
			// crudToastInterceptor MUST come before requestContextInterceptor because
			// Analog's interceptor transforms relative URLs (/api/...) to absolute URLs
			// (http://host/api/...), which breaks the toast interceptor's URL matching regex.
			withInterceptors([crudToastInterceptor, requestContextInterceptor]),
		),
		...providePageBlocks(),
	],
};

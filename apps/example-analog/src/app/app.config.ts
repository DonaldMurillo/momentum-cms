import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import type { Routes } from '@angular/router';
import {
	momentumAdminRoutes,
	crudToastInterceptor,
	provideMomentumFieldRenderers,
	provideFieldRenderer,
} from '@momentumcms/admin';

import { collections } from '@momentumcms/example-config/collections';

import { globals } from '@momentumcms/example-config/globals';
import { BASE_AUTH_COLLECTIONS } from '@momentumcms/auth/collections';

import { analyticsAdminRoutes } from '@momentumcms/plugins-analytics/admin-routes';
import { seoAdminRoutes } from '@momentumcms/plugins-seo/admin-routes';
import { emailAdminRoutes } from '@momentumcms/plugins-email/admin-routes';

import { injectBlockAnalyticsFields } from '@momentumcms/plugins-analytics/block-fields';
import { injectSeoFields } from '@momentumcms/plugins-seo/fields';
import { EmailTemplatesCollection } from '@momentumcms/plugins/email';

import { providePageBlocks, pageResolver } from '@momentumcms/example-config/pages';

// Merge all collections for admin routes, then inject plugin fields
const adminCollections = [...collections, ...BASE_AUTH_COLLECTIONS, EmailTemplatesCollection];
injectBlockAnalyticsFields(adminCollections);
injectSeoFields(adminCollections, { collections: ['categories', 'articles', 'pages'] });

// Page routes — defined explicitly so the PageComponent receives route params directly
// (Analog's file-based routing wraps components in loadChildren, which can interfere with param inheritance)
const pageRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
		data: { slug: 'home' },
		resolve: { pageData: pageResolver },
	},
	// Experiments page (must be before :slug catch-all)
	{
		path: 'experiments',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.ExperimentsPage),
	},
	{
		path: ':slug',
		loadComponent: () => import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
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
	pluginRoutes: [...analyticsAdminRoutes, ...seoAdminRoutes, ...emailAdminRoutes],
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
		provideMomentumFieldRenderers(),
		provideFieldRenderer('json-email-builder', () =>
			import('@momentumcms/email-builder').then((m) => m.EmailBuilderFieldRendererComponent),
		),
		...providePageBlocks(),
	],
};

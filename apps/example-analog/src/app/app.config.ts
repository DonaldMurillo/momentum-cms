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
import { queueAdminRoutes } from '@momentumcms/plugins-queue/admin-routes';
import { cronAdminRoutes } from '@momentumcms/plugins-cron/admin-routes';

import { injectBlockAnalyticsFields } from '@momentumcms/plugins-analytics/block-fields';
import { injectSeoFields } from '@momentumcms/plugins-seo/fields';
import { EmailTemplatesCollection } from '@momentumcms/plugins/email';
import { QueueJobsCollection } from '@momentumcms/plugins-queue/collections';
import { CronSchedulesCollection } from '@momentumcms/plugins-cron/collections';
import { RedirectsCollection } from '@momentumcms/plugins-redirects/collections';
import {
	FormsCollection,
	FormSubmissionsCollection,
} from '@momentumcms/plugins-form-builder/collections';
import { providePageViewTracking } from '@momentumcms/plugins-analytics/page-tracker';

import { provideMomentumFormBuilder } from '@momentumcms/form-builder';
import {
	providePageBlocks,
	pageResolver,
	articleDetailResolver,
} from '@momentumcms/example-config/pages';

// Merge all collections for admin routes, then inject plugin fields
const adminCollections = [
	...collections,
	...BASE_AUTH_COLLECTIONS,
	EmailTemplatesCollection,
	QueueJobsCollection,
	CronSchedulesCollection,
	RedirectsCollection,
	FormsCollection,
	FormSubmissionsCollection,
];
injectBlockAnalyticsFields(adminCollections);
injectSeoFields(adminCollections, { collections: ['categories', 'articles', 'pages'] });

// Page routes — defined explicitly so the PageComponent receives route params directly
// (Analog's file-based routing wraps components in loadChildren, which can interfere with param inheritance)
const pageRoutes: Routes = [
	{
		path: 'theme-editor',
		loadComponent: () =>
			import('@momentumcms/example-config/pages').then((m) => m.ThemeEditorWrapperPage),
	},
	{
		path: '',
		loadComponent: () =>
			import('@momentumcms/example-config/pages').then((m) => m.AppLayoutComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
				data: { slug: 'home' },
				resolve: { pageData: pageResolver },
			},
			// Articles listing page
			{
				path: 'articles',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.ArticlesPageComponent),
			},
			// Article detail page
			{
				path: 'articles/:slug',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.ArticleDetailComponent),
				resolve: { articleData: articleDetailResolver },
			},
			// Experiments page (must be before :slug catch-all)
			{
				path: 'experiments',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.ExperimentsPage),
			},
			// Headless styling lab entry page for non-Angular examples
			{
				path: 'headless-styling-lab',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.HeadlessStylingLabTeaserPage),
			},
			{
				path: ':slug',
				loadComponent: () =>
					import('@momentumcms/example-config/pages').then((m) => m.PageComponent),
				resolve: { pageData: pageResolver },
			},
		],
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
	pluginRoutes: [
		...analyticsAdminRoutes,
		...seoAdminRoutes,
		...emailAdminRoutes,
		...queueAdminRoutes,
		...cronAdminRoutes,
	],
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
		provideFieldRenderer('json-form-builder', () =>
			import('@momentumcms/form-builder').then((m) => m.FormSchemaFieldRendererComponent),
		),
		...providePageBlocks(),
		provideMomentumFormBuilder(),
		providePageViewTracking({
			contentRoutes: {
				articles: '/articles/:slug',
				categories: '/categories/:slug',
				pages: '/:slug',
			},
		}),
	],
};

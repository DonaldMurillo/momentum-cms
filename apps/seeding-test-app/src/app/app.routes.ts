import type { Route } from '@angular/router';
import { momentumAdminRoutes, type AdminPluginRoute } from '@momentum-cms/admin';
import { collections } from '../collections';

/**
 * Plugin admin routes.
 *
 * These are defined at the app level to avoid importing server-express
 * (which contains Node.js dependencies) into the browser bundle.
 * They correspond to routes registered by plugins via registerAdminRoute()
 * in momentum.config.ts.
 */
const pluginRoutes: AdminPluginRoute[] = [
	{
		path: 'analytics',
		label: 'Analytics',
		icon: 'heroChartBarSquare',
		loadComponent: () =>
			import('../pages/analytics-dashboard.page').then((m) => m.AnalyticsDashboardPage),
		group: 'Tools',
	},
];

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
		pluginRoutes,
	}),
];

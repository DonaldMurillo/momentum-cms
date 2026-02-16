/**
 * Default analytics admin route descriptors.
 *
 * Browser-safe: no server-side dependencies (Express, pg, etc.).
 * This file is the entry point for `@momentumcms/plugins/analytics/admin-routes`.
 *
 * Three admin pages:
 * - Analytics Dashboard  — general system overview (all event types, API metrics, sessions)
 * - Content Performance  — deep-dive page traffic analysis (per-URL visitors, referrers)
 * - Tracking Rules       — admin-managed CSS-selector-to-event mappings for the client rule engine
 *
 * Used by:
 * - Angular app routing (browser build)
 * - Analytics plugin factory (server build, as defaults)
 */
import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

/**
 * Default analytics admin dashboard route.
 * Lazily loads the built-in dashboard component.
 */
export const analyticsAdminRoutes: PluginAdminRouteDescriptor[] = [
	{
		path: 'analytics',
		label: 'Analytics',
		icon: 'heroChartBarSquare',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/analytics-dashboard.page').then((m) => m.AnalyticsDashboardPage),
		group: 'Analytics',
	},
	{
		path: 'analytics/content',
		label: 'Content Perf.',
		icon: 'heroDocumentText',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/content-performance.page').then((m) => m.ContentPerformancePage),
		group: 'Analytics',
	},
	{
		path: 'analytics/tracking-rules',
		label: 'Tracking Rules',
		icon: 'heroCursorArrowRays',
		loadComponent: (): Promise<unknown> =>
			import('./dashboard/tracking-rules.page').then((m) => m.TrackingRulesPage),
		group: 'Analytics',
	},
];

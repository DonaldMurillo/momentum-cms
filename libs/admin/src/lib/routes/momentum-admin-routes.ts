/**
 * Momentum Admin Routes Factory
 *
 * Creates Angular routes for the admin UI that can be integrated into
 * any Angular application or Analog.js app.
 *
 * Usage in Angular:
 * ```typescript
 * import { momentumAdminRoutes } from '@momentumcms/admin';
 * import { collections } from './collections';
 *
 * export const routes: Routes = [
 *   ...momentumAdminRoutes({
 *     basePath: '/admin',
 *     collections,
 *   }),
 * ];
 * ```
 */

import type { Routes, Route } from '@angular/router';
import type { Type } from '@angular/core';
import type {
	CollectionConfig,
	GlobalConfig,
	MomentumConfig,
	MomentumPlugin,
	PluginAdminRouteDescriptor,
} from '@momentumcms/core';
import { authGuard } from '../guards/auth.guard';
import { guestGuard } from '../guards/guest.guard';
import { setupGuard } from '../guards/setup.guard';
import { collectionAccessGuard } from '../guards/collection-access.guard';
import { unsavedChangesGuard } from '../guards/unsaved-changes.guard';

export interface MomentumAdminBranding {
	/** Logo URL */
	logo?: string;
	/** Site title */
	title?: string;
	/** Primary color (CSS color value) */
	primaryColor?: string;
}

/**
 * Admin plugin route descriptor with Angular-typed loadComponent.
 * Mirrors Angular Route concepts (path, loadComponent, data) with
 * additional Momentum sidebar metadata (label, icon, group).
 */
export interface AdminPluginRoute {
	/** Route path under admin (e.g., 'analytics') — same as Angular Route.path */
	path: string;
	/** Lazy component loader — same as Angular Route.loadComponent */
	loadComponent: () => Promise<Type<unknown>>;
	/** Optional route data — same as Angular Route.data */
	data?: Record<string, unknown>;
	/** Sidebar display label */
	label: string;
	/** Icon name from ng-icons (e.g., 'heroChartBarSquare') */
	icon: string;
	/** Sidebar section name. @default 'Plugins' */
	group?: string;
}

export interface MomentumAdminOptions {
	/** Base path for admin routes (e.g., '/admin') */
	basePath: string;
	/** Collection configurations */
	collections: CollectionConfig[];
	/** Global configurations (singleton documents) */
	globals?: GlobalConfig[];
	/** Optional branding customization */
	branding?: MomentumAdminBranding;
	/** Whether to include auth routes (login, setup). Defaults to true */
	includeAuthRoutes?: boolean;
	/** Plugin-registered admin routes. Accepts both Angular-typed and core-typed descriptors. */
	pluginRoutes?: AdminPluginRoute[] | PluginAdminRouteDescriptor[];
	/** Plugins — their static collections and admin routes are merged automatically. */
	plugins?: MomentumPlugin[];
}

export interface MomentumAdminRouteData {
	collections: CollectionConfig[];
	globals?: GlobalConfig[];
	branding?: MomentumAdminBranding;
	pluginRoutes?: AdminPluginRoute[];
}

/**
 * Converts a PluginAdminRouteDescriptor (from core) to an AdminPluginRoute (Angular-typed).
 */
function toAdminPluginRoute(descriptor: PluginAdminRouteDescriptor): AdminPluginRoute {
	return {
		path: descriptor.path,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- core uses `unknown` for loadComponent to avoid Angular dependency
		loadComponent: descriptor.loadComponent as () => Promise<Type<unknown>>,
		data: descriptor.data,
		label: descriptor.label,
		icon: descriptor.icon,
		group: descriptor.group,
	};
}

/**
 * Creates Angular routes for the Momentum CMS admin UI.
 *
 * Can be called with a full `MomentumConfig` (config-driven) or explicit options.
 *
 * Config-driven usage (recommended):
 * ```typescript
 * import config from '../momentum.config';
 * export const routes = [...momentumAdminRoutes(config)];
 * ```
 *
 * Options-based usage:
 * ```typescript
 * momentumAdminRoutes({ basePath: '/admin', collections, branding })
 * ```
 */
export function momentumAdminRoutes(config: MomentumConfig): Routes;
export function momentumAdminRoutes(options: MomentumAdminOptions): Routes;
export function momentumAdminRoutes(
	configOrOptions: MomentumConfig | MomentumAdminOptions,
): Routes {
	let basePath: string;
	let collections: CollectionConfig[];
	let globals: GlobalConfig[] | undefined;
	let branding: MomentumAdminBranding | undefined;
	let includeAuthRoutes: boolean;
	let pluginRoutes: AdminPluginRoute[] | undefined;

	let plugins: MomentumPlugin[];

	// Distinguish MomentumConfig (has `db`) from MomentumAdminOptions (has `basePath` as required string)
	if ('db' in configOrOptions) {
		const config = configOrOptions;
		basePath = (config.admin?.basePath ?? '/admin').replace(/^\//, '');
		plugins = config.plugins ?? [];

		// Merge static config collections with plugin-declared collections (e.g. auth collections)
		const pluginCollections = plugins.flatMap((p) => p.collections ?? []);
		const configSlugs = new Set(config.collections.map((c) => c.slug));
		const uniquePluginCollections = pluginCollections.filter((c) => !configSlugs.has(c.slug));
		collections = [...config.collections, ...uniquePluginCollections];

		globals = config.globals;
		branding = config.admin?.branding;
		includeAuthRoutes = true;
		pluginRoutes = plugins.flatMap((p) => p.adminRoutes ?? []).map(toAdminPluginRoute);
	} else {
		basePath = configOrOptions.basePath.replace(/^\//, '');
		plugins = configOrOptions.plugins ?? [];

		// Merge plugin-declared collections (e.g. auth collections) with explicit collections
		const pluginCollections = plugins.flatMap((p) => p.collections ?? []);
		const optSlugs = new Set(configOrOptions.collections.map((c) => c.slug));
		const uniquePluginCollections = pluginCollections.filter((c) => !optSlugs.has(c.slug));
		collections = [...configOrOptions.collections, ...uniquePluginCollections];

		globals = configOrOptions.globals;
		branding = configOrOptions.branding;
		includeAuthRoutes = configOrOptions.includeAuthRoutes ?? true;

		// Merge explicit plugin routes with plugin-declared admin routes
		const explicitRoutes = configOrOptions.pluginRoutes?.map(toAdminPluginRoute) ?? [];
		const pluginDeclaredRoutes = plugins
			.flatMap((p) => p.adminRoutes ?? [])
			.map(toAdminPluginRoute);
		pluginRoutes = [...explicitRoutes, ...pluginDeclaredRoutes];
	}

	// Apply plugin collection transforms (e.g. analytics field injection)
	for (const plugin of plugins) {
		if (plugin.modifyCollections) {
			plugin.modifyCollections(collections);
		}
	}

	const routeData: MomentumAdminRouteData = {
		collections,
		globals,
		branding,
		pluginRoutes,
	};

	const routes: Routes = [];

	// Auth routes (login, setup, password reset) - outside the admin shell
	if (includeAuthRoutes) {
		routes.push(
			// Login page - only for unauthenticated users
			{
				path: `${basePath}/login`,
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/login/login.page').then((m) => m.LoginPage),
				canActivate: [guestGuard],
			},
			// Setup page - only when no users exist
			{
				path: `${basePath}/setup`,
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/setup/setup.page').then((m) => m.SetupPage),
				canActivate: [setupGuard],
			},
			// Forgot password page - only for unauthenticated users
			{
				path: `${basePath}/forgot-password`,
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
				canActivate: [guestGuard],
			},
			// Reset password page - only for unauthenticated users
			{
				path: `${basePath}/reset-password`,
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
				canActivate: [guestGuard],
			},
		);
	}

	// Main admin route with shell - protected by authGuard
	const adminRoute: Route = {
		path: basePath,
		loadComponent: (): Promise<Type<unknown>> =>
			import('../components/shell/admin-shell.component').then((m) => m.AdminShellComponent),
		data: routeData,
		canActivate: [authGuard],
		children: [
			// Dashboard (default route)
			{
				path: '',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
			},
			// Media library
			{
				path: 'media',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/media-library/media-library.page').then((m) => m.MediaLibraryPage),
			},
			// Collection list
			{
				path: 'collections/:slug',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-list/collection-list.page').then((m) => m.CollectionListPage),
				canActivate: [collectionAccessGuard],
			},
			// Create new document
			{
				path: 'collections/:slug/new',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-edit/collection-edit.page').then((m) => m.CollectionEditPage),
				canActivate: [collectionAccessGuard],
				canDeactivate: [unsavedChangesGuard],
			},
			// View existing document
			{
				path: 'collections/:slug/:id',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-view/collection-view.page').then((m) => m.CollectionViewPage),
				canActivate: [collectionAccessGuard],
			},
			// Edit existing document
			{
				path: 'collections/:slug/:id/edit',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-edit/collection-edit.page').then((m) => m.CollectionEditPage),
				canActivate: [collectionAccessGuard],
				canDeactivate: [unsavedChangesGuard],
			},
			// Global edit
			{
				path: 'globals/:slug',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/global-edit/global-edit.page').then((m) => m.GlobalEditPage),
				canDeactivate: [unsavedChangesGuard],
			},
			// Plugin-registered routes
			...(pluginRoutes ?? []).map((pr) => ({
				path: pr.path,
				loadComponent: pr.loadComponent,
				data: pr.data,
			})),
		],
	};

	routes.push(adminRoute);

	return routes;
}

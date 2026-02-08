/**
 * Momentum Admin Routes Factory
 *
 * Creates Angular routes for the admin UI that can be integrated into
 * any Angular application or Analog.js app.
 *
 * Usage in Angular:
 * ```typescript
 * import { momentumAdminRoutes } from '@momentum-cms/admin';
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
import type { CollectionConfig } from '@momentum-cms/core';
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
	/** Optional branding customization */
	branding?: MomentumAdminBranding;
	/** Whether to include auth routes (login, setup). Defaults to true */
	includeAuthRoutes?: boolean;
	/** Plugin-registered admin routes */
	pluginRoutes?: AdminPluginRoute[];
}

export interface MomentumAdminRouteData {
	collections: CollectionConfig[];
	branding?: MomentumAdminBranding;
	pluginRoutes?: AdminPluginRoute[];
}

/**
 * Creates Angular routes for the Momentum CMS admin UI
 * @param options Configuration options
 * @returns Array of Angular routes
 */
export function momentumAdminRoutes(options: MomentumAdminOptions): Routes {
	// Remove leading slash from basePath
	const basePath = options.basePath.replace(/^\//, '');
	const includeAuthRoutes = options.includeAuthRoutes ?? true;

	const routeData: MomentumAdminRouteData = {
		collections: options.collections,
		branding: options.branding,
		pluginRoutes: options.pluginRoutes,
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
			// Plugin-registered routes
			...(options.pluginRoutes ?? []).map((pr) => ({
				path: pr.path,
				loadComponent: pr.loadComponent,
				data: pr.data,
			})),
		],
	};

	routes.push(adminRoute);

	return routes;
}

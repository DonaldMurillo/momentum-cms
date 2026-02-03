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

export interface MomentumAdminBranding {
	/** Logo URL */
	logo?: string;
	/** Site title */
	title?: string;
	/** Primary color (CSS color value) */
	primaryColor?: string;
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
}

export interface MomentumAdminRouteData {
	collections: CollectionConfig[];
	branding?: MomentumAdminBranding;
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
	};

	const routes: Routes = [];

	// Auth routes (login, setup) - outside the admin shell
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
			// Collection list
			{
				path: 'collections/:slug',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-list/collection-list.page').then((m) => m.CollectionListPage),
				canActivate: [collectionAccessGuard],
			},
			// Create new document
			{
				path: 'collections/:slug/create',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-edit/collection-edit.page').then((m) => m.CollectionEditPage),
				canActivate: [collectionAccessGuard],
			},
			// Edit existing document
			{
				path: 'collections/:slug/:id',
				loadComponent: (): Promise<Type<unknown>> =>
					import('../pages/collection-edit/collection-edit.page').then((m) => m.CollectionEditPage),
				canActivate: [collectionAccessGuard],
			},
		],
	};

	routes.push(adminRoute);

	return routes;
}

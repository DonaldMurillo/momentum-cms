import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type CanActivateFn } from '@angular/router';
import { MomentumAuthService } from '../services/auth.service';

/**
 * Auth guard that protects routes requiring authentication.
 *
 * Redirects to:
 * - /admin/setup if no users exist (first-time setup)
 * - /admin/login if user is not authenticated
 *
 * Note: During SSR, the guard allows access and defers auth checks to client-side
 * hydration. This is necessary because SSR doesn't have access to browser cookies.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'dashboard',
 *     component: DashboardPage,
 *     canActivate: [authGuard],
 *   },
 * ];
 * ```
 */
export const authGuard: CanActivateFn = async () => {
	const platformId = inject(PLATFORM_ID);
	const auth = inject(MomentumAuthService);
	const router = inject(Router);

	// During SSR, allow access - auth checks will run on client after hydration
	// SSR doesn't have access to browser cookies, so auth would always fail
	if (!isPlatformBrowser(platformId)) {
		return true;
	}

	// Wait for auth to initialize if still loading
	if (auth.loading()) {
		await auth.initialize();
	}

	// Redirect to setup if no users exist
	if (auth.needsSetup()) {
		return router.createUrlTree(['/admin/setup']);
	}

	// Redirect to login if not authenticated
	if (!auth.isAuthenticated()) {
		return router.createUrlTree(['/admin/login']);
	}

	return true;
};

/**
 * Admin guard that requires admin role.
 *
 * Redirects to:
 * - /admin/setup if no users exist
 * - /admin/login if user is not authenticated
 * - /admin if user is not an admin
 *
 * Note: During SSR, the guard allows access and defers auth checks to client-side
 * hydration. This is necessary because SSR doesn't have access to browser cookies.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'settings',
 *     component: SettingsPage,
 *     canActivate: [adminGuard],
 *   },
 * ];
 * ```
 */
export const adminGuard: CanActivateFn = async () => {
	const platformId = inject(PLATFORM_ID);
	const auth = inject(MomentumAuthService);
	const router = inject(Router);

	// During SSR, allow access - auth checks will run on client after hydration
	// SSR doesn't have access to browser cookies, so auth would always fail
	if (!isPlatformBrowser(platformId)) {
		return true;
	}

	// Wait for auth to initialize if still loading
	if (auth.loading()) {
		await auth.initialize();
	}

	// Redirect to setup if no users exist
	if (auth.needsSetup()) {
		return router.createUrlTree(['/admin/setup']);
	}

	// Redirect to login if not authenticated
	if (!auth.isAuthenticated()) {
		return router.createUrlTree(['/admin/login']);
	}

	// Redirect to dashboard if not admin
	if (!auth.isAdmin()) {
		return router.createUrlTree(['/admin']);
	}

	return true;
};

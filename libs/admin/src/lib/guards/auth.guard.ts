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
 * During SSR, the guard allows access and defers redirect decisions to
 * client-side hydration. The session resolver middleware provides user
 * context for SSR rendering via MOMENTUM_API_CONTEXT/injectUser(), but
 * guards return true during SSR to avoid hydration conflicts.
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

	// During SSR, allow access - redirect decisions deferred to client-side
	// to avoid hydration conflicts. User context is available for rendering
	// via MOMENTUM_API_CONTEXT/injectUser().
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
 * During SSR, the guard allows access and defers redirect decisions to
 * client-side hydration to avoid hydration conflicts.
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

	// During SSR, allow access - redirect decisions deferred to client-side
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

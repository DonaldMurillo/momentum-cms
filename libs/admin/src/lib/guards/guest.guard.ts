import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type CanActivateFn } from '@angular/router';
import { MomentumAuthService } from '../services/auth.service';

/**
 * Guest guard that allows access only to unauthenticated users.
 *
 * Redirects to:
 * - /admin/setup if no users exist (first-time setup)
 * - /admin if user is already authenticated
 *
 * Note: During SSR, the guard allows access and defers auth checks to client-side
 * hydration. This is necessary because SSR doesn't have access to browser cookies.
 *
 * Use this guard for login/register pages.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'login',
 *     component: LoginPage,
 *     canActivate: [guestGuard],
 *   },
 * ];
 * ```
 */
export const guestGuard: CanActivateFn = async () => {
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

	// Redirect to dashboard if already authenticated
	if (auth.isAuthenticated()) {
		return router.createUrlTree(['/admin']);
	}

	return true;
};

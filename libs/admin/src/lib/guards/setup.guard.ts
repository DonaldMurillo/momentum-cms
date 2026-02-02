import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type CanActivateFn } from '@angular/router';
import { MomentumAuthService } from '../services/auth.service';

/**
 * Setup guard that allows access only when no users exist.
 *
 * Redirects to:
 * - /admin/login if users already exist
 *
 * Note: During SSR, the guard allows access and defers auth checks to client-side
 * hydration. This is necessary because SSR doesn't have access to browser cookies.
 *
 * Use this guard for the initial setup/first user creation page.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'setup',
 *     component: SetupPage,
 *     canActivate: [setupGuard],
 *   },
 * ];
 * ```
 */
export const setupGuard: CanActivateFn = async () => {
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

	// Only allow access if setup is needed
	if (!auth.needsSetup()) {
		// If already authenticated, go to dashboard
		if (auth.isAuthenticated()) {
			return router.createUrlTree(['/admin']);
		}
		// Otherwise go to login
		return router.createUrlTree(['/admin/login']);
	}

	return true;
};

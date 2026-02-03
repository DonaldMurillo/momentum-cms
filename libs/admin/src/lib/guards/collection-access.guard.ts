import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type CanActivateFn, type ActivatedRouteSnapshot } from '@angular/router';
import { MomentumAuthService } from '../services/auth.service';
import { CollectionAccessService } from '../services/collection-access.service';

/**
 * Collection access guard that checks if the user can access a specific collection.
 *
 * This guard should be used on routes that have a :slug parameter in the path.
 * It checks the collection-level `admin` access function to determine if the
 * user is allowed to view the collection in the admin panel.
 *
 * Redirects to:
 * - /admin/setup if no users exist
 * - /admin/login if user is not authenticated
 * - /admin if user cannot access the collection
 *
 * Note: During SSR, the guard allows access and defers checks to client-side
 * hydration. This is necessary because SSR doesn't have access to browser cookies.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'collections/:slug',
 *     component: CollectionListPage,
 *     canActivate: [authGuard, collectionAccessGuard],
 *   },
 * ];
 * ```
 */
export const collectionAccessGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
	const platformId = inject(PLATFORM_ID);
	const auth = inject(MomentumAuthService);
	const collectionAccess = inject(CollectionAccessService);
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

	// Load collection permissions if not loaded
	if (!collectionAccess.initialized()) {
		await collectionAccess.loadAccess();
	}

	// Get the collection slug from route params
	const slug = route.params['slug'];
	if (!slug) {
		// No slug in route, allow access (shouldn't happen with proper routing)
		return true;
	}

	// Check if user can access this collection
	if (!collectionAccess.canAccess(slug)) {
		// Redirect to admin dashboard if no access
		return router.createUrlTree(['/admin']);
	}

	return true;
};

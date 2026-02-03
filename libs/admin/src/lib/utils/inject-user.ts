/**
 * User Injection Utilities for Momentum CMS
 *
 * Provides type-safe access to the current authenticated user in both
 * SSR and browser contexts using Angular signals.
 *
 * @example
 * ```typescript
 * import type { Users } from './types/momentum.generated';
 * import { injectUser } from '@momentum-cms/admin';
 *
 * @Component({...})
 * export class MyComponent {
 *   // Typed user from your generated types
 *   readonly user = injectUser<Users>();
 *
 *   // Or use convenience functions
 *   readonly isAdmin = injectIsAdmin();
 *   readonly isAuthenticated = injectIsAuthenticated();
 * }
 * ```
 */

import { inject, computed, Signal, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { MOMENTUM_API_CONTEXT } from '../services/momentum-api.service';
import { MomentumAuthService, AuthUser } from '../services/auth.service';

/**
 * Base user type that all user types must extend.
 * Matches the common fields between Better Auth users and Momentum collection users.
 */
export interface BaseUser {
	id: string | number;
	email?: string;
	role?: string;
}

/**
 * Inject the current authenticated user with proper typing.
 *
 * Works seamlessly in both SSR and browser contexts:
 * - **SSR**: Returns user from `MOMENTUM_API_CONTEXT` (set by session resolver middleware)
 * - **Browser**: Returns user from `MomentumAuthService` (fetched via /api/auth/get-session)
 *
 * The generic type parameter allows you to use your generated collection types
 * for full type safety with your user schema.
 *
 * @typeParam T - User type extending UserContext (use your generated Users type)
 * @returns Signal containing the current user or null if not authenticated
 *
 * @example
 * ```typescript
 * import type { Users } from './types/momentum.generated';
 *
 * @Component({...})
 * export class ProfileComponent {
 *   readonly user = injectUser<Users>();
 *
 *   constructor() {
 *     effect(() => {
 *       const currentUser = this.user();
 *       if (currentUser) {
 *         console.log('Role:', currentUser.role); // Typed!
 *       }
 *     });
 *   }
 * }
 * ```
 */
export function injectUser<T extends BaseUser = AuthUser>(): Signal<T | null> {
	const platformId = inject(PLATFORM_ID);

	if (isPlatformServer(platformId)) {
		// SSR: Get user from context provided by session resolver middleware
		const context = inject(MOMENTUM_API_CONTEXT, { optional: true });
		const user = context?.user ?? null;
		// Return computed signal (SSR is single-request, value won't change)
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- UserContext to generic T
		return computed(() => user as T | null);
	} else {
		// Browser: Get user from auth service (reactive to session changes)
		const authService = inject(MomentumAuthService);
		return computed(() => {
			const authUser = authService.user();
			if (!authUser) return null;
			// Cast AuthUser to generic T (the fields are compatible)
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- AuthUser to generic T
			return authUser as unknown as T;
		});
	}
}

/**
 * Inject the current user's role.
 *
 * Convenience wrapper that returns just the role string.
 *
 * @returns Signal containing the user's role or null if not authenticated
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class NavComponent {
 *   readonly role = injectUserRole();
 *
 *   canEdit = computed(() => {
 *     const r = this.role();
 *     return r === 'admin' || r === 'editor';
 *   });
 * }
 * ```
 */
export function injectUserRole(): Signal<string | null> {
	const platformId = inject(PLATFORM_ID);

	if (isPlatformServer(platformId)) {
		const context = inject(MOMENTUM_API_CONTEXT, { optional: true });
		return computed(() => context?.user?.role ?? null);
	} else {
		const authService = inject(MomentumAuthService);
		return computed(() => authService.user()?.role ?? null);
	}
}

/**
 * Inject whether the current user is authenticated.
 *
 * @returns Signal containing true if user is authenticated, false otherwise
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (isAuthenticated()) {
 *       <user-menu />
 *     } @else {
 *       <login-button />
 *     }
 *   `
 * })
 * export class HeaderComponent {
 *   readonly isAuthenticated = injectIsAuthenticated();
 * }
 * ```
 */
export function injectIsAuthenticated(): Signal<boolean> {
	const platformId = inject(PLATFORM_ID);

	if (isPlatformServer(platformId)) {
		const context = inject(MOMENTUM_API_CONTEXT, { optional: true });
		return computed(() => context?.user !== undefined && context?.user !== null);
	} else {
		const authService = inject(MomentumAuthService);
		return computed(() => authService.isAuthenticated());
	}
}

/**
 * Inject whether the current user is an admin.
 *
 * @returns Signal containing true if user has admin role, false otherwise
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (isAdmin()) {
 *       <admin-settings />
 *     }
 *   `
 * })
 * export class SettingsComponent {
 *   readonly isAdmin = injectIsAdmin();
 * }
 * ```
 */
export function injectIsAdmin(): Signal<boolean> {
	const platformId = inject(PLATFORM_ID);

	if (isPlatformServer(platformId)) {
		const context = inject(MOMENTUM_API_CONTEXT, { optional: true });
		return computed(() => context?.user?.role === 'admin');
	} else {
		const authService = inject(MomentumAuthService);
		return computed(() => authService.isAdmin());
	}
}

/**
 * Inject whether the current user has a specific role.
 *
 * @param role - The role to check for
 * @returns Signal containing true if user has the specified role
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class EditorComponent {
 *   readonly canEdit = injectHasRole('editor');
 * }
 * ```
 */
export function injectHasRole(role: string): Signal<boolean> {
	const userRole = injectUserRole();
	return computed(() => userRole() === role);
}

/**
 * Inject whether the current user has any of the specified roles.
 *
 * @param roles - Array of roles to check
 * @returns Signal containing true if user has any of the specified roles
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class ContentComponent {
 *   readonly canManageContent = injectHasAnyRole(['admin', 'editor']);
 * }
 * ```
 */
export function injectHasAnyRole(roles: string[]): Signal<boolean> {
	const userRole = injectUserRole();
	return computed(() => {
		const currentRole = userRole();
		return currentRole !== null && roles.includes(currentRole);
	});
}

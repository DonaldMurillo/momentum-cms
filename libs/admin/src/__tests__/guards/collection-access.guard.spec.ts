/**
 * Collection Access Guard Unit Tests
 *
 * Tests the guard decision logic in isolation.
 * Full integration testing is done via E2E tests.
 */
import { describe, it, expect, vi } from 'vitest';

// Test the guard decision logic in isolation without Angular DI
describe('collectionAccessGuard Logic', () => {
	// Simulate the guard decision flow
	interface MockAuthState {
		loading: boolean;
		needsSetup: boolean;
		isAuthenticated: boolean;
	}

	interface MockAccessState {
		initialized: boolean;
		canAccess: (slug: string) => boolean;
	}

	type GuardResult = 'allow' | 'redirect-setup' | 'redirect-login' | 'redirect-admin';

	const evaluateGuard = (
		isBrowser: boolean,
		authState: MockAuthState,
		accessState: MockAccessState,
		slug: string | undefined,
	): GuardResult => {
		// SSR always allows
		if (!isBrowser) {
			return 'allow';
		}

		// Redirect to setup if needed
		if (authState.needsSetup) {
			return 'redirect-setup';
		}

		// Redirect to login if not authenticated
		if (!authState.isAuthenticated) {
			return 'redirect-login';
		}

		// No slug = allow
		if (!slug) {
			return 'allow';
		}

		// Check collection access
		if (!accessState.canAccess(slug)) {
			return 'redirect-admin';
		}

		return 'allow';
	};

	describe('SSR handling', () => {
		it('should always allow access during SSR', () => {
			const result = evaluateGuard(
				false, // SSR
				{ loading: false, needsSetup: false, isAuthenticated: false },
				{ initialized: false, canAccess: () => false },
				'posts',
			);
			expect(result).toBe('allow');
		});

		it('should allow SSR even when setup is needed', () => {
			const result = evaluateGuard(
				false, // SSR
				{ loading: false, needsSetup: true, isAuthenticated: false },
				{ initialized: false, canAccess: () => false },
				'posts',
			);
			expect(result).toBe('allow');
		});
	});

	describe('setup redirect', () => {
		it('should redirect to setup when needsSetup is true', () => {
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: true, isAuthenticated: false },
				{ initialized: true, canAccess: () => true },
				'posts',
			);
			expect(result).toBe('redirect-setup');
		});
	});

	describe('authentication redirect', () => {
		it('should redirect to login when not authenticated', () => {
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: false },
				{ initialized: true, canAccess: () => true },
				'posts',
			);
			expect(result).toBe('redirect-login');
		});
	});

	describe('collection access', () => {
		it('should allow access when canAccess returns true', () => {
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: true },
				{ initialized: true, canAccess: () => true },
				'posts',
			);
			expect(result).toBe('allow');
		});

		it('should redirect to admin when canAccess returns false', () => {
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: true },
				{ initialized: true, canAccess: () => false },
				'users',
			);
			expect(result).toBe('redirect-admin');
		});

		it('should check access for the correct slug', () => {
			const canAccess = vi.fn((slug: string) => slug === 'posts');

			const postsResult = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: true },
				{ initialized: true, canAccess },
				'posts',
			);
			expect(postsResult).toBe('allow');
			expect(canAccess).toHaveBeenCalledWith('posts');

			canAccess.mockClear();

			const usersResult = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: true },
				{ initialized: true, canAccess },
				'users',
			);
			expect(usersResult).toBe('redirect-admin');
			expect(canAccess).toHaveBeenCalledWith('users');
		});

		it('should allow access when no slug in route', () => {
			const canAccess = vi.fn(() => false);

			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: true },
				{ initialized: true, canAccess },
				undefined,
			);
			expect(result).toBe('allow');
			expect(canAccess).not.toHaveBeenCalled();
		});
	});

	describe('priority of checks', () => {
		it('should check setup before authentication', () => {
			// Even if authenticated, should redirect to setup
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: true, isAuthenticated: true },
				{ initialized: true, canAccess: () => true },
				'posts',
			);
			expect(result).toBe('redirect-setup');
		});

		it('should check authentication before collection access', () => {
			// Even if collection is accessible, should redirect to login
			const result = evaluateGuard(
				true,
				{ loading: false, needsSetup: false, isAuthenticated: false },
				{ initialized: true, canAccess: () => true },
				'posts',
			);
			expect(result).toBe('redirect-login');
		});
	});
});

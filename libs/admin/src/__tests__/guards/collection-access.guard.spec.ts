/**
 * Collection Access Guard Unit Tests
 *
 * Tests the real collectionAccessGuard using TestBed with signal-based mocks.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, type ActivatedRouteSnapshot } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, signal, computed } from '@angular/core';
import { collectionAccessGuard } from '../../lib/guards/collection-access.guard';
import { MomentumAuthService } from '../../lib/services/auth.service';
import { CollectionAccessService } from '../../lib/services/collection-access.service';

describe('collectionAccessGuard', () => {
	// Writable signals for controlling auth state per-test
	let authLoading: ReturnType<typeof signal<boolean>>;
	let authNeedsSetup: ReturnType<typeof signal<boolean>>;
	let authUser: ReturnType<typeof signal<null | { id: string }>>;
	let accessInitialized: ReturnType<typeof signal<boolean>>;

	// Spied methods
	let initializeSpy: ReturnType<typeof vi.fn>;
	let canAccessSpy: ReturnType<typeof vi.fn>;
	let loadAccessSpy: ReturnType<typeof vi.fn>;

	/** Run the guard with a given route slug */
	async function runGuard(slug: string | undefined, platformId = 'browser'): Promise<unknown> {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: platformId },
				{
					provide: MomentumAuthService,
					useValue: {
						loading: authLoading,
						needsSetup: authNeedsSetup,
						isAuthenticated: computed(() => authUser() !== null),
						user: authUser,
						initialize: initializeSpy,
					},
				},
				{
					provide: CollectionAccessService,
					useValue: {
						initialized: accessInitialized,
						canAccess: canAccessSpy,
						loadAccess: loadAccessSpy,
					},
				},
			],
		});

		const route = { params: slug ? { slug } : {} } as unknown as ActivatedRouteSnapshot;
		return TestBed.runInInjectionContext(() => collectionAccessGuard(route, {} as never));
	}

	beforeEach(() => {
		authLoading = signal(false);
		authNeedsSetup = signal(false);
		authUser = signal<null | { id: string }>({ id: '1' }); // authenticated by default
		accessInitialized = signal(true);

		initializeSpy = vi.fn().mockResolvedValue(undefined);
		canAccessSpy = vi.fn().mockReturnValue(true);
		loadAccessSpy = vi.fn().mockResolvedValue(undefined);
	});

	describe('SSR handling', () => {
		it('should always allow access during SSR', async () => {
			authUser.set(null); // not authenticated
			const result = await runGuard('posts', 'server');
			expect(result).toBe(true);
		});

		it('should allow SSR even when setup is needed', async () => {
			authNeedsSetup.set(true);
			authUser.set(null);

			const result = await runGuard('posts', 'server');
			expect(result).toBe(true);
		});
	});

	describe('setup redirect', () => {
		it('should redirect to setup when needsSetup is true', async () => {
			authNeedsSetup.set(true);

			const result = await runGuard('posts');
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin/setup');
		});
	});

	describe('authentication redirect', () => {
		it('should redirect to login when not authenticated', async () => {
			authUser.set(null);

			const result = await runGuard('posts');
			expect(String(result)).toContain('/admin/login');
		});

		it('should call initialize() when auth is still loading', async () => {
			authLoading.set(true);

			await runGuard('posts');
			expect(initializeSpy).toHaveBeenCalled();
		});
	});

	describe('collection access', () => {
		it('should allow access when canAccess returns true', async () => {
			canAccessSpy.mockReturnValue(true);

			const result = await runGuard('posts');
			expect(result).toBe(true);
		});

		it('should redirect to admin when canAccess returns false', async () => {
			canAccessSpy.mockReturnValue(false);

			const result = await runGuard('users');
			expect(String(result)).toContain('/admin');
		});

		it('should check access for the correct slug', async () => {
			await runGuard('posts');
			expect(canAccessSpy).toHaveBeenCalledWith('posts');
		});

		it('should allow access when no slug in route', async () => {
			const result = await runGuard(undefined);
			expect(result).toBe(true);
			expect(canAccessSpy).not.toHaveBeenCalled();
		});

		it('should load permissions when not initialized', async () => {
			accessInitialized.set(false);

			await runGuard('posts');
			expect(loadAccessSpy).toHaveBeenCalled();
		});
	});

	describe('priority of checks', () => {
		it('should check setup before authentication', async () => {
			authNeedsSetup.set(true);
			// Even though authenticated, should redirect to setup
			const result = await runGuard('posts');
			expect(String(result)).toContain('/admin/setup');
		});

		it('should check authentication before collection access', async () => {
			authUser.set(null); // not authenticated
			canAccessSpy.mockReturnValue(true); // even though collection is accessible

			const result = await runGuard('posts');
			expect(String(result)).toContain('/admin/login');
		});
	});
});

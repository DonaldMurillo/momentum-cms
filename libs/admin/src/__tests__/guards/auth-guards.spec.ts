/**
 * Auth Guards Unit Tests
 *
 * Tests authGuard, adminGuard, guestGuard, setupGuard, and unsavedChangesGuard
 * using TestBed with signal-based mocks.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, type ActivatedRouteSnapshot, type CanActivateFn } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, signal, computed } from '@angular/core';
import { authGuard, adminGuard } from '../../lib/guards/auth.guard';
import { guestGuard } from '../../lib/guards/guest.guard';
import { setupGuard } from '../../lib/guards/setup.guard';
import {
	unsavedChangesGuard,
	type HasUnsavedChanges,
} from '../../lib/guards/unsaved-changes.guard';
import { MomentumAuthService } from '../../lib/services/auth.service';
import { FeedbackService } from '../../lib/widgets/feedback/feedback.service';

describe('Auth Guards', () => {
	// Writable signals for controlling auth state per-test
	let authLoading: ReturnType<typeof signal<boolean>>;
	let authNeedsSetup: ReturnType<typeof signal<boolean>>;
	let authUser: ReturnType<typeof signal<null | { id: string }>>;
	let isAdminSignal: ReturnType<typeof signal<boolean>>;

	// Spied methods
	let initializeSpy: ReturnType<typeof vi.fn>;

	/** Run a CanActivateFn guard with the given platform ID */
	async function runGuard(guardFn: CanActivateFn, platformId = 'browser'): Promise<unknown> {
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
						isAdmin: computed(() => isAdminSignal()),
						user: authUser,
						initialize: initializeSpy,
					},
				},
			],
		});

		const route = {} as ActivatedRouteSnapshot;
		return TestBed.runInInjectionContext(() => guardFn(route, {} as never));
	}

	beforeEach(() => {
		authLoading = signal(false);
		authNeedsSetup = signal(false);
		authUser = signal<null | { id: string }>({ id: '1' }); // authenticated by default
		isAdminSignal = signal(false);
		initializeSpy = vi.fn().mockResolvedValue(undefined);
	});

	// ─── authGuard ───────────────────────────────────────────────────────

	describe('authGuard', () => {
		it('should allow access during SSR', async () => {
			authUser.set(null);
			const result = await runGuard(authGuard, 'server');
			expect(result).toBe(true);
		});

		it('should allow authenticated user', async () => {
			const result = await runGuard(authGuard);
			expect(result).toBe(true);
		});

		it('should redirect to /admin/setup when needsSetup', async () => {
			authNeedsSetup.set(true);
			const result = await runGuard(authGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin/setup');
		});

		it('should redirect to /admin/login when not authenticated', async () => {
			authUser.set(null);
			const result = await runGuard(authGuard);
			expect(String(result)).toContain('/admin/login');
		});

		it('should call initialize when loading', async () => {
			authLoading.set(true);
			await runGuard(authGuard);
			expect(initializeSpy).toHaveBeenCalled();
		});
	});

	// ─── adminGuard ──────────────────────────────────────────────────────

	describe('adminGuard', () => {
		it('should allow access during SSR', async () => {
			authUser.set(null);
			const result = await runGuard(adminGuard, 'server');
			expect(result).toBe(true);
		});

		it('should allow admin user', async () => {
			isAdminSignal.set(true);
			const result = await runGuard(adminGuard);
			expect(result).toBe(true);
		});

		it('should redirect to /admin/setup when needsSetup', async () => {
			authNeedsSetup.set(true);
			const result = await runGuard(adminGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin/setup');
		});

		it('should redirect to /admin/login when not authenticated', async () => {
			authUser.set(null);
			const result = await runGuard(adminGuard);
			expect(String(result)).toContain('/admin/login');
		});

		it('should redirect to /admin when not admin', async () => {
			isAdminSignal.set(false);
			const result = await runGuard(adminGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin');
			// Ensure it's not redirecting to /admin/login or /admin/setup
			expect(String(result)).not.toContain('/admin/login');
			expect(String(result)).not.toContain('/admin/setup');
		});
	});

	// ─── guestGuard ──────────────────────────────────────────────────────

	describe('guestGuard', () => {
		it('should allow access during SSR', async () => {
			const result = await runGuard(guestGuard, 'server');
			expect(result).toBe(true);
		});

		it('should allow unauthenticated user', async () => {
			authUser.set(null);
			const result = await runGuard(guestGuard);
			expect(result).toBe(true);
		});

		it('should redirect to /admin/setup when needsSetup', async () => {
			authNeedsSetup.set(true);
			const result = await runGuard(guestGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin/setup');
		});

		it('should redirect to /admin when authenticated', async () => {
			const result = await runGuard(guestGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin');
			expect(String(result)).not.toContain('/admin/login');
			expect(String(result)).not.toContain('/admin/setup');
		});
	});

	// ─── setupGuard ──────────────────────────────────────────────────────

	describe('setupGuard', () => {
		it('should allow access during SSR', async () => {
			const result = await runGuard(setupGuard, 'server');
			expect(result).toBe(true);
		});

		it('should allow access when needsSetup', async () => {
			authNeedsSetup.set(true);
			const result = await runGuard(setupGuard);
			expect(result).toBe(true);
		});

		it('should redirect to /admin when authenticated and no setup needed', async () => {
			authNeedsSetup.set(false);
			authUser.set({ id: '1' });
			const result = await runGuard(setupGuard);
			expect(result).not.toBe(true);
			expect(String(result)).toContain('/admin');
			expect(String(result)).not.toContain('/admin/login');
			expect(String(result)).not.toContain('/admin/setup');
		});

		it('should redirect to /admin/login when not authenticated and no setup needed', async () => {
			authNeedsSetup.set(false);
			authUser.set(null);
			const result = await runGuard(setupGuard);
			expect(String(result)).toContain('/admin/login');
		});
	});

	// ─── unsavedChangesGuard ─────────────────────────────────────────────

	describe('unsavedChangesGuard', () => {
		let confirmDiscardSpy: ReturnType<typeof vi.fn>;

		function runDeactivateGuard(hasChanges: boolean): unknown {
			confirmDiscardSpy = vi.fn().mockResolvedValue(true);

			TestBed.configureTestingModule({
				providers: [
					provideRouter([]),
					provideHttpClient(),
					provideHttpClientTesting(),
					{
						provide: FeedbackService,
						useValue: {
							confirmDiscard: confirmDiscardSpy,
						},
					},
				],
			});

			const component: HasUnsavedChanges = {
				hasUnsavedChanges: () => hasChanges,
			};

			return TestBed.runInInjectionContext(() =>
				unsavedChangesGuard(component, {} as never, {} as never, {} as never),
			);
		}

		it('should allow navigation when no unsaved changes', () => {
			const result = runDeactivateGuard(false);
			expect(result).toBe(true);
			expect(confirmDiscardSpy).not.toHaveBeenCalled();
		});

		it('should call confirmDiscard when has unsaved changes', async () => {
			const result = await runDeactivateGuard(true);
			expect(confirmDiscardSpy).toHaveBeenCalled();
			expect(result).toBe(true);
		});
	});
});

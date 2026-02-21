import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
	injectUser,
	injectUserRole,
	injectIsAuthenticated,
	injectIsAdmin,
	injectHasRole,
	injectHasAnyRole,
} from '../inject-user';
import { MomentumAuthService } from '../../services/auth.service';
import { MOMENTUM_API_CONTEXT } from '../../services/momentum-api.service';

// Mock auth service that uses signals
class MockAuthService {
	readonly user = signal<{ id: string; email: string; role: string; name: string } | null>(null);
	readonly loading = signal(false);
	readonly isAuthenticated = signal(false);
	readonly isAdmin = signal(false);

	role(): string | null {
		return this.user()?.role ?? null;
	}

	setUser(user: { id: string; email: string; role: string; name: string } | null): void {
		this.user.set(user);
		this.isAuthenticated.set(user !== null);
		this.isAdmin.set(user?.role === 'admin');
	}
}

const testAdmin = { id: '1', email: 'admin@test.com', role: 'admin', name: 'Admin' };
const testEditor = { id: '2', email: 'editor@test.com', role: 'editor', name: 'Editor' };
const testViewer = { id: '3', email: 'viewer@test.com', role: 'viewer', name: 'Viewer' };

describe('inject-user utilities (browser context)', () => {
	let mockAuth: MockAuthService;

	beforeEach(() => {
		mockAuth = new MockAuthService();

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		});
	});

	describe('injectUser', () => {
		it('should return null when no user is authenticated', () => {
			const user = TestBed.runInInjectionContext(() => injectUser());
			expect(user()).toBeNull();
		});

		it('should return user when authenticated', () => {
			mockAuth.setUser(testAdmin);
			const user = TestBed.runInInjectionContext(() => injectUser());
			expect(user()).toEqual(expect.objectContaining({ id: '1', email: 'admin@test.com' }));
		});

		it('should reactively update when user changes', () => {
			const user = TestBed.runInInjectionContext(() => injectUser());
			expect(user()).toBeNull();

			mockAuth.setUser(testEditor);
			expect(user()).toEqual(expect.objectContaining({ id: '2' }));
		});
	});

	describe('injectUserRole', () => {
		it('should return null when no user', () => {
			const role = TestBed.runInInjectionContext(() => injectUserRole());
			expect(role()).toBeNull();
		});

		it('should return role when user exists', () => {
			mockAuth.setUser(testAdmin);
			const role = TestBed.runInInjectionContext(() => injectUserRole());
			expect(role()).toBe('admin');
		});
	});

	describe('injectIsAuthenticated', () => {
		it('should return false when no user', () => {
			const isAuth = TestBed.runInInjectionContext(() => injectIsAuthenticated());
			expect(isAuth()).toBe(false);
		});

		it('should return true when user exists', () => {
			mockAuth.setUser(testViewer);
			const isAuth = TestBed.runInInjectionContext(() => injectIsAuthenticated());
			expect(isAuth()).toBe(true);
		});
	});

	describe('injectIsAdmin', () => {
		it('should return false when no user', () => {
			const isAdm = TestBed.runInInjectionContext(() => injectIsAdmin());
			expect(isAdm()).toBe(false);
		});

		it('should return true for admin users', () => {
			mockAuth.setUser(testAdmin);
			const isAdm = TestBed.runInInjectionContext(() => injectIsAdmin());
			expect(isAdm()).toBe(true);
		});

		it('should return false for non-admin users', () => {
			mockAuth.setUser(testEditor);
			const isAdm = TestBed.runInInjectionContext(() => injectIsAdmin());
			expect(isAdm()).toBe(false);
		});
	});

	describe('injectHasRole', () => {
		it('should return true when user has matching role', () => {
			mockAuth.setUser(testEditor);
			const hasRole = TestBed.runInInjectionContext(() => injectHasRole('editor'));
			expect(hasRole()).toBe(true);
		});

		it('should return false when user has different role', () => {
			mockAuth.setUser(testEditor);
			const hasRole = TestBed.runInInjectionContext(() => injectHasRole('admin'));
			expect(hasRole()).toBe(false);
		});

		it('should return false when no user', () => {
			const hasRole = TestBed.runInInjectionContext(() => injectHasRole('admin'));
			expect(hasRole()).toBe(false);
		});
	});

	describe('injectHasAnyRole', () => {
		it('should return true when user role is in the list', () => {
			mockAuth.setUser(testEditor);
			const has = TestBed.runInInjectionContext(() => injectHasAnyRole(['admin', 'editor']));
			expect(has()).toBe(true);
		});

		it('should return false when user role is not in the list', () => {
			mockAuth.setUser(testViewer);
			const has = TestBed.runInInjectionContext(() => injectHasAnyRole(['admin', 'editor']));
			expect(has()).toBe(false);
		});

		it('should return false when no user', () => {
			const has = TestBed.runInInjectionContext(() => injectHasAnyRole(['admin']));
			expect(has()).toBe(false);
		});

		it('should return false for empty roles array', () => {
			mockAuth.setUser(testAdmin);
			const has = TestBed.runInInjectionContext(() => injectHasAnyRole([]));
			expect(has()).toBe(false);
		});
	});
});

describe('inject-user utilities (server context)', () => {
	describe('with API context user', () => {
		const serverUser = { id: '10', email: 'ssr@test.com', role: 'admin', name: 'SSR User' };

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: PLATFORM_ID, useValue: 'server' },
					{
						provide: MOMENTUM_API_CONTEXT,
						useValue: { user: serverUser },
					},
				],
			});
		});

		it('injectUser should return user from context', () => {
			const user = TestBed.runInInjectionContext(() => injectUser());
			expect(user()).toEqual(expect.objectContaining({ id: '10', role: 'admin' }));
		});

		it('injectUserRole should return role from context', () => {
			const role = TestBed.runInInjectionContext(() => injectUserRole());
			expect(role()).toBe('admin');
		});

		it('injectIsAuthenticated should return true', () => {
			const isAuth = TestBed.runInInjectionContext(() => injectIsAuthenticated());
			expect(isAuth()).toBe(true);
		});

		it('injectIsAdmin should return true for admin', () => {
			const isAdm = TestBed.runInInjectionContext(() => injectIsAdmin());
			expect(isAdm()).toBe(true);
		});
	});

	describe('without API context', () => {
		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: PLATFORM_ID, useValue: 'server' },
				],
			});
		});

		it('injectUser should return null', () => {
			const user = TestBed.runInInjectionContext(() => injectUser());
			expect(user()).toBeNull();
		});

		it('injectIsAuthenticated should return false', () => {
			const isAuth = TestBed.runInInjectionContext(() => injectIsAuthenticated());
			expect(isAuth()).toBe(false);
		});

		it('injectIsAdmin should return false', () => {
			const isAdm = TestBed.runInInjectionContext(() => injectIsAdmin());
			expect(isAdm()).toBe(false);
		});
	});
});

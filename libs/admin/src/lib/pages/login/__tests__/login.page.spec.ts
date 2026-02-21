import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { LoginPage } from '../login.page';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Record<string, unknown> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		signIn: vi.fn().mockResolvedValue({ success: true }),
		getOAuthProviders: vi.fn().mockResolvedValue([]),
		signInWithOAuth: vi.fn(),
	};
}

describe('LoginPage', () => {
	let fixture: ComponentFixture<LoginPage>;
	let component: LoginPage;
	let router: Router;
	let mockAuth: Record<string, unknown>;

	beforeEach(async () => {
		mockAuth = createMockAuth();

		await TestBed.configureTestingModule({
			imports: [LoginPage],
			providers: [
				provideRouter([
					{ path: 'admin', component: LoginPage },
					{ path: 'admin/forgot-password', component: LoginPage },
				]),
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(LoginPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create the page', () => {
		expect(component).toBeTruthy();
	});

	it('should render a login form', () => {
		const form = fixture.nativeElement.querySelector('form');
		expect(form).toBeTruthy();
	});

	it('should render email and password fields', () => {
		const fields = fixture.nativeElement.querySelectorAll('mcms-form-field');
		expect(fields.length).toBeGreaterThanOrEqual(2);
	});

	describe('email validation', () => {
		it('should not show errors before touched', () => {
			expect(component.emailErrors()).toEqual([]);
		});

		it('should show required error when email is empty and touched', () => {
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show email error for invalid email format', () => {
			component.email.set('not-an-email');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'email' })]);
		});

		it('should return no errors for valid email', () => {
			component.email.set('user@example.com');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([]);
		});
	});

	describe('password validation', () => {
		it('should not show errors before touched', () => {
			expect(component.passwordErrors()).toEqual([]);
		});

		it('should show required error when password is empty and touched', () => {
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should return no errors for non-empty password', () => {
			component.password.set('secret123');
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([]);
		});
	});

	describe('isValid', () => {
		it('should be false when fields are empty', () => {
			expect(component.isValid()).toBe(false);
		});

		it('should be true when email and password are filled', () => {
			component.email.set('user@example.com');
			component.password.set('password');
			expect(component.isValid()).toBe(true);
		});
	});

	describe('onSubmit', () => {
		it('should set touched on submit', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.touched()).toBe(true);
		});

		it('should not call signIn when form is invalid', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['signIn']).not.toHaveBeenCalled();
		});

		it('should call signIn with email and password when valid', async () => {
			component.email.set('user@example.com');
			component.password.set('password');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['signIn']).toHaveBeenCalledWith('user@example.com', 'password');
		});

		it('should navigate to admin on successful sign-in', async () => {
			component.email.set('user@example.com');
			component.password.set('password');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(router.navigate).toHaveBeenCalledWith(['/admin']);
		});

		it('should set error on failed sign-in', async () => {
			(mockAuth['signIn'] as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: 'Invalid credentials',
			});
			component.email.set('user@example.com');
			component.password.set('password');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('Invalid credentials');
		});

		it('should set generic error on exception', async () => {
			(mockAuth['signIn'] as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Network error'),
			);
			component.email.set('user@example.com');
			component.password.set('password');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('An unexpected error occurred');
		});

		it('should reset isSubmitting after submission', async () => {
			component.email.set('user@example.com');
			component.password.set('password');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.isSubmitting()).toBe(false);
		});
	});

	describe('OAuth', () => {
		it('should load OAuth providers on init', () => {
			expect(mockAuth['getOAuthProviders']).toHaveBeenCalled();
		});

		it('should render OAuth buttons when providers exist', async () => {
			(mockAuth['getOAuthProviders'] as ReturnType<typeof vi.fn>).mockResolvedValue([
				'github',
				'google',
			]);
			// Re-init
			await component.ngOnInit();
			fixture.detectChanges();
			expect(component.oauthProviders()).toEqual(['github', 'google']);
		});

		it('should call signInWithOAuth when OAuth button is clicked', () => {
			component.signInWithOAuth('github');
			expect(mockAuth['signInWithOAuth']).toHaveBeenCalledWith('github');
		});
	});
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ResetPasswordFormComponent } from '../reset-password-form.component';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Record<string, unknown> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		resetPassword: vi.fn().mockResolvedValue({ success: true }),
	};
}

describe('ResetPasswordFormComponent', () => {
	let fixture: ComponentFixture<ResetPasswordFormComponent>;
	let component: ResetPasswordFormComponent;
	let mockAuth: Record<string, unknown>;

	beforeEach(async () => {
		mockAuth = createMockAuth();

		await TestBed.configureTestingModule({
			imports: [ResetPasswordFormComponent],
			providers: [{ provide: MomentumAuthService, useValue: mockAuth }],
		}).compileComponents();

		fixture = TestBed.createComponent(ResetPasswordFormComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('token', 'valid-token-123');
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create the component', () => {
		expect(component).toBeTruthy();
	});

	it('should render a form', () => {
		const form = fixture.nativeElement.querySelector('form');
		expect(form).toBeTruthy();
	});

	describe('password validation', () => {
		it('should not show errors before touched', () => {
			expect(component.passwordErrors()).toEqual([]);
		});

		it('should show required error when password is empty and touched', () => {
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show minlength error for short password', () => {
			component.password.set('abc');
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([expect.objectContaining({ kind: 'minlength' })]);
		});

		it('should return no errors for valid password', () => {
			component.password.set('password123');
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([]);
		});
	});

	describe('confirm password validation', () => {
		it('should not show errors before touched', () => {
			expect(component.confirmPasswordErrors()).toEqual([]);
		});

		it('should show required error when empty and touched', () => {
			component.touched.set(true);
			expect(component.confirmPasswordErrors()).toEqual([
				expect.objectContaining({ kind: 'required' }),
			]);
		});

		it('should show mismatch error when passwords differ', () => {
			component.password.set('password123');
			component.confirmPassword.set('different');
			component.touched.set(true);
			expect(component.confirmPasswordErrors()).toEqual([
				expect.objectContaining({ kind: 'mismatch' }),
			]);
		});

		it('should return no errors when passwords match', () => {
			component.password.set('password123');
			component.confirmPassword.set('password123');
			component.touched.set(true);
			expect(component.confirmPasswordErrors()).toEqual([]);
		});
	});

	describe('isValid', () => {
		it('should be false when fields are empty', () => {
			expect(component.isValid()).toBe(false);
		});

		it('should be true when passwords are valid and match', () => {
			component.password.set('password123');
			component.confirmPassword.set('password123');
			expect(component.isValid()).toBe(true);
		});

		it('should be false when passwords do not match', () => {
			component.password.set('password123');
			component.confirmPassword.set('different');
			expect(component.isValid()).toBe(false);
		});
	});

	describe('onSubmit', () => {
		function fillValidForm(): void {
			component.password.set('password123');
			component.confirmPassword.set('password123');
		}

		it('should set touched on submit', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.touched()).toBe(true);
		});

		it('should not call resetPassword when form is invalid', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['resetPassword']).not.toHaveBeenCalled();
		});

		it('should not call resetPassword when token is missing', async () => {
			fixture.componentRef.setInput('token', '');
			fixture.detectChanges();
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['resetPassword']).not.toHaveBeenCalled();
		});

		it('should call resetPassword with token and password', async () => {
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['resetPassword']).toHaveBeenCalledWith('valid-token-123', 'password123');
		});

		it('should set resetSuccess on successful reset', async () => {
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.resetSuccess()).toBe(true);
		});

		it('should emit resetComplete on success', async () => {
			const spy = vi.fn();
			component.resetComplete.subscribe(spy);
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should set error on failed reset', async () => {
			(mockAuth['resetPassword'] as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: 'Token expired',
			});
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('Token expired');
		});

		it('should emit resetFailed on failed reset', async () => {
			const spy = vi.fn();
			component.resetFailed.subscribe(spy);
			(mockAuth['resetPassword'] as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: 'Token expired',
			});
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(spy).toHaveBeenCalledWith('Token expired');
		});

		it('should set generic error on exception', async () => {
			(mockAuth['resetPassword'] as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Network error'),
			);
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('An unexpected error occurred');
		});

		it('should reset isSubmitting after submission', async () => {
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.isSubmitting()).toBe(false);
		});
	});

	describe('navigation outputs', () => {
		it('should emit goToLogin when onGoToLogin is called', () => {
			const spy = vi.fn();
			component.goToLogin.subscribe(spy);
			component.onGoToLogin();
			expect(spy).toHaveBeenCalled();
		});

		it('should emit goToForgotPassword when onGoToForgotPassword is called', () => {
			const spy = vi.fn();
			component.goToForgotPassword.subscribe(spy);
			component.onGoToForgotPassword();
			expect(spy).toHaveBeenCalled();
		});
	});
});

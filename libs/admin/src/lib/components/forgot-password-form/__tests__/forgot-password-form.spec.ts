import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ForgotPasswordFormComponent } from '../forgot-password-form.component';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Record<string, unknown> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
	};
}

describe('ForgotPasswordFormComponent', () => {
	let fixture: ComponentFixture<ForgotPasswordFormComponent>;
	let component: ForgotPasswordFormComponent;
	let mockAuth: Record<string, unknown>;

	beforeEach(async () => {
		mockAuth = createMockAuth();

		await TestBed.configureTestingModule({
			imports: [ForgotPasswordFormComponent],
			providers: [{ provide: MomentumAuthService, useValue: mockAuth }],
		}).compileComponents();

		fixture = TestBed.createComponent(ForgotPasswordFormComponent);
		component = fixture.componentInstance;
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

	describe('email validation', () => {
		it('should not show errors before touched', () => {
			expect(component.emailErrors()).toEqual([]);
		});

		it('should show required error when email is empty and touched', () => {
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show email error for invalid format', () => {
			component.email.set('not-valid');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'email' })]);
		});

		it('should return no errors for valid email', () => {
			component.email.set('user@example.com');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([]);
		});
	});

	describe('isValid', () => {
		it('should be false when email is empty', () => {
			expect(component.isValid()).toBe(false);
		});

		it('should be true for valid email', () => {
			component.email.set('user@example.com');
			expect(component.isValid()).toBe(true);
		});
	});

	describe('onSubmit', () => {
		it('should set touched on submit', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.touched()).toBe(true);
		});

		it('should not call requestPasswordReset when invalid', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['requestPasswordReset']).not.toHaveBeenCalled();
		});

		it('should call requestPasswordReset with email when valid', async () => {
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['requestPasswordReset']).toHaveBeenCalledWith('user@example.com');
		});

		it('should set submitted to true on success', async () => {
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.submitted()).toBe(true);
		});

		it('should emit resetRequested with email on success', async () => {
			const spy = vi.fn();
			component.resetRequested.subscribe(spy);
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(spy).toHaveBeenCalledWith('user@example.com');
		});

		it('should set error on failure', async () => {
			(mockAuth['requestPasswordReset'] as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: 'Service unavailable',
			});
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('Service unavailable');
		});

		it('should set generic error on exception', async () => {
			(mockAuth['requestPasswordReset'] as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Network error'),
			);
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('An unexpected error occurred');
		});

		it('should reset isSubmitting after submission', async () => {
			component.email.set('user@example.com');
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.isSubmitting()).toBe(false);
		});
	});

	describe('backToLogin output', () => {
		it('should emit backToLogin when onBackToLogin is called', () => {
			const spy = vi.fn();
			component.backToLogin.subscribe(spy);
			component.onBackToLogin();
			expect(spy).toHaveBeenCalled();
		});
	});
});

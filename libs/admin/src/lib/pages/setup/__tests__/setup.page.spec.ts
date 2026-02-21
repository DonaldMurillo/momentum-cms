import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { SetupPage } from '../setup.page';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Record<string, unknown> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		signUp: vi.fn().mockResolvedValue({ success: true }),
		signIn: vi.fn().mockResolvedValue({ success: true }),
	};
}

describe('SetupPage', () => {
	let fixture: ComponentFixture<SetupPage>;
	let component: SetupPage;
	let router: Router;
	let mockAuth: Record<string, unknown>;

	beforeEach(async () => {
		mockAuth = createMockAuth();

		await TestBed.configureTestingModule({
			imports: [SetupPage],
			providers: [
				provideRouter([
					{ path: 'admin', component: SetupPage },
					{ path: 'admin/login', component: SetupPage },
				]),
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(SetupPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create the page', () => {
		expect(component).toBeTruthy();
	});

	it('should render a form with 4 fields', () => {
		const fields = fixture.nativeElement.querySelectorAll('mcms-form-field');
		expect(fields.length).toBe(4);
	});

	describe('name validation', () => {
		it('should not show errors before touched', () => {
			expect(component.nameErrors()).toEqual([]);
		});

		it('should show required error when name is empty and touched', () => {
			component.touched.set(true);
			expect(component.nameErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show required error for whitespace-only name', () => {
			component.name.set('   ');
			component.touched.set(true);
			expect(component.nameErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});
	});

	describe('email validation', () => {
		it('should show required error when empty and touched', () => {
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show email error for invalid format', () => {
			component.email.set('invalid');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([expect.objectContaining({ kind: 'email' })]);
		});

		it('should return no errors for valid email', () => {
			component.email.set('admin@example.com');
			component.touched.set(true);
			expect(component.emailErrors()).toEqual([]);
		});
	});

	describe('password validation', () => {
		it('should show required error when empty and touched', () => {
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([expect.objectContaining({ kind: 'required' })]);
		});

		it('should show minLength error for short password', () => {
			component.password.set('abc');
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([expect.objectContaining({ kind: 'minLength' })]);
		});

		it('should return no errors for valid password', () => {
			component.password.set('password123');
			component.touched.set(true);
			expect(component.passwordErrors()).toEqual([]);
		});
	});

	describe('confirm password validation', () => {
		it('should show required error when empty and touched', () => {
			component.touched.set(true);
			expect(component.confirmPasswordErrors()).toEqual([
				expect.objectContaining({ kind: 'required' }),
			]);
		});

		it('should show match error when passwords differ', () => {
			component.password.set('password123');
			component.confirmPassword.set('different');
			component.touched.set(true);
			expect(component.confirmPasswordErrors()).toEqual([
				expect.objectContaining({ kind: 'match' }),
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

		it('should be true when all fields are valid', () => {
			component.name.set('Admin');
			component.email.set('admin@example.com');
			component.password.set('password123');
			component.confirmPassword.set('password123');
			expect(component.isValid()).toBe(true);
		});

		it('should be false when passwords do not match', () => {
			component.name.set('Admin');
			component.email.set('admin@example.com');
			component.password.set('password123');
			component.confirmPassword.set('different');
			expect(component.isValid()).toBe(false);
		});
	});

	describe('onSubmit', () => {
		function fillValidForm(): void {
			component.name.set('Admin');
			component.email.set('admin@example.com');
			component.password.set('password123');
			component.confirmPassword.set('password123');
		}

		it('should set touched on submit', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.touched()).toBe(true);
		});

		it('should not call signUp when form is invalid', async () => {
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['signUp']).not.toHaveBeenCalled();
		});

		it('should call signUp with correct arguments', async () => {
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['signUp']).toHaveBeenCalledWith(
				'Admin',
				'admin@example.com',
				'password123',
				true,
			);
		});

		it('should auto sign-in after successful signup and navigate to admin', async () => {
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(mockAuth['signIn']).toHaveBeenCalledWith('admin@example.com', 'password123');
			expect(router.navigate).toHaveBeenCalledWith(['/admin']);
		});

		it('should navigate to login if auto sign-in fails', async () => {
			(mockAuth['signIn'] as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
		});

		it('should set error on failed signup', async () => {
			(mockAuth['signUp'] as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: 'Email taken',
			});
			fillValidForm();
			const event = new Event('submit', { cancelable: true });
			await component.onSubmit(event);
			expect(component.error()).toBe('Email taken');
		});

		it('should set generic error on exception', async () => {
			(mockAuth['signUp'] as ReturnType<typeof vi.fn>).mockRejectedValue(
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
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { computed, signal } from '@angular/core';
import { ResetPasswordPage } from '../reset-password.page';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Partial<MomentumAuthService> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		resetPassword: vi.fn().mockResolvedValue({ success: true }),
	} as Partial<MomentumAuthService>;
}

describe('ResetPasswordPage', () => {
	let fixture: ComponentFixture<ResetPasswordPage>;
	let component: ResetPasswordPage;
	let router: Router;

	function setup(token: string | null = 'test-token-123'): void {
		TestBed.configureTestingModule({
			imports: [ResetPasswordPage],
			providers: [
				provideRouter([
					{ path: 'admin/login', component: ResetPasswordPage },
					{ path: 'admin/forgot-password', component: ResetPasswordPage },
				]),
				{ provide: MomentumAuthService, useValue: createMockAuth() },
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							queryParamMap: {
								get: (key: string): string | null => (key === 'token' ? token : null),
							},
						},
					},
				},
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(ResetPasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	it('should create the page', () => {
		setup();
		expect(component).toBeTruthy();
	});

	it('should read token from route query params', () => {
		setup('my-reset-token');
		expect(component.token()).toBe('my-reset-token');
	});

	it('should set empty token when query param is missing', () => {
		setup(null);
		expect(component.token()).toBe('');
	});

	it('should navigate to login on navigateToLogin()', () => {
		setup();
		component.navigateToLogin();
		expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
	});

	it('should navigate to forgot-password on navigateToForgotPassword()', () => {
		setup();
		component.navigateToForgotPassword();
		expect(router.navigate).toHaveBeenCalledWith(['/admin/forgot-password']);
	});

	it('should render the reset-password-form component', () => {
		setup();
		const form = fixture.nativeElement.querySelector('mcms-reset-password-form');
		expect(form).toBeTruthy();
	});
});

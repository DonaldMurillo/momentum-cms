import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { ForgotPasswordPage } from '../forgot-password.page';
import { MomentumAuthService } from '../../../services/auth.service';

function createMockAuth(): Partial<MomentumAuthService> {
	return {
		user: signal(null),
		loading: signal(false),
		isAuthenticated: computed(() => false),
		requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
	} as Partial<MomentumAuthService>;
}

describe('ForgotPasswordPage', () => {
	let fixture: ComponentFixture<ForgotPasswordPage>;
	let component: ForgotPasswordPage;
	let router: Router;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ForgotPasswordPage],
			providers: [
				provideRouter([{ path: 'admin/login', component: ForgotPasswordPage }]),
				{ provide: MomentumAuthService, useValue: createMockAuth() },
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(ForgotPasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create the page', () => {
		expect(component).toBeTruthy();
	});

	it('should render the forgot-password-form component', () => {
		const form = fixture.nativeElement.querySelector('mcms-forgot-password-form');
		expect(form).toBeTruthy();
	});

	it('should navigate to login when backToLogin is emitted', () => {
		component.navigateToLogin();
		expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
	});

	it('should have a card wrapper with title', () => {
		const card = fixture.nativeElement.querySelector('mcms-card');
		expect(card).toBeTruthy();
	});
});

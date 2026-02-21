import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '@momentumcms/ui';
import { ForgotPasswordFormComponent } from '../../components/forgot-password-form/forgot-password-form.component';

/**
 * Forgot Password Page
 *
 * Full-page wrapper for the forgot password form.
 * Uses a centered card layout matching the login page.
 */
@Component({
	selector: 'mcms-forgot-password-page',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter,
		ForgotPasswordFormComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex min-h-screen items-center justify-center bg-background p-4',
	},
	template: `
		<main>
			<mcms-card class="w-full max-w-md">
				<mcms-card-header class="text-center">
					<mcms-card-title>Reset Password</mcms-card-title>
					<mcms-card-description>
						We'll send you a link to reset your password
					</mcms-card-description>
				</mcms-card-header>

				<mcms-card-content>
					<mcms-forgot-password-form (backToLogin)="navigateToLogin()" />
				</mcms-card-content>

				<mcms-card-footer class="justify-center">
					<p class="text-sm text-muted-foreground">Momentum CMS</p>
				</mcms-card-footer>
			</mcms-card>
		</main>
	`,
})
export class ForgotPasswordPage {
	private readonly router = inject(Router);

	navigateToLogin(): void {
		void this.router.navigate(['/admin/login']);
	}
}

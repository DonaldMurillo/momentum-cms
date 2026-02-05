import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '@momentum-cms/ui';
import { ResetPasswordFormComponent } from '../../components/reset-password-form/reset-password-form.component';

/**
 * Reset Password Page
 *
 * Full-page wrapper for the reset password form.
 * Reads the token from query parameters and passes it to the form.
 */
@Component({
	selector: 'mcms-reset-password-page',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter,
		ResetPasswordFormComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex min-h-screen items-center justify-center bg-background p-4',
	},
	template: `
		<mcms-card class="w-full max-w-md">
			<mcms-card-header class="text-center">
				<mcms-card-title>Set New Password</mcms-card-title>
				<mcms-card-description> Enter your new password below </mcms-card-description>
			</mcms-card-header>

			<mcms-card-content>
				<mcms-reset-password-form
					[token]="token()"
					(goToLogin)="navigateToLogin()"
					(goToForgotPassword)="navigateToForgotPassword()"
				/>
			</mcms-card-content>

			<mcms-card-footer class="justify-center">
				<p class="text-sm text-muted-foreground">Momentum CMS</p>
			</mcms-card-footer>
		</mcms-card>
	`,
})
export class ResetPasswordPage implements OnInit {
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	readonly token = signal('');

	ngOnInit(): void {
		// Get token from query params
		const tokenParam = this.route.snapshot.queryParamMap.get('token');
		if (tokenParam) {
			this.token.set(tokenParam);
		}
	}

	navigateToLogin(): void {
		void this.router.navigate(['/admin/login']);
	}

	navigateToForgotPassword(): void {
		void this.router.navigate(['/admin/forgot-password']);
	}
}

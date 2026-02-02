import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
	Input,
	Button,
	FormField,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '@momentum-cms/ui';
import { MomentumAuthService } from '../../services/auth.service';

/**
 * Login Page Component
 *
 * Allows users to sign in with email and password.
 */
@Component({
	selector: 'mcms-login-page',
	imports: [
		Input,
		Button,
		FormField,
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex min-h-screen items-center justify-center bg-background p-4',
	},
	template: `
		<mcms-card class="w-full max-w-md">
			<mcms-card-header class="text-center">
				<mcms-card-title>Sign In</mcms-card-title>
				<mcms-card-description>
					Enter your credentials to access the admin dashboard
				</mcms-card-description>
			</mcms-card-header>

			<mcms-card-content>
				<form (submit)="onSubmit($event)" class="space-y-4">
					@if (error()) {
						<div
							class="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
							role="alert"
							aria-live="polite"
						>
							{{ error() }}
						</div>
					}

					<mcms-form-field id="email" [required]="true" [errors]="emailErrors()">
						<span mcmsLabel>Email</span>
						<mcms-input
							type="email"
							id="email"
							name="email"
							[(value)]="email"
							placeholder="admin@example.com"
							autocomplete="email"
							[disabled]="isSubmitting()"
						/>
					</mcms-form-field>

					<mcms-form-field id="password" [required]="true" [errors]="passwordErrors()">
						<span mcmsLabel>Password</span>
						<mcms-input
							type="password"
							id="password"
							name="password"
							[(value)]="password"
							placeholder="Enter your password"
							autocomplete="current-password"
							[disabled]="isSubmitting()"
						/>
					</mcms-form-field>

					<button
						mcms-button
						type="submit"
						class="w-full"
						[disabled]="isSubmitting() || !isValid()"
					>
						@if (isSubmitting()) {
							<span class="animate-spin">⏳</span>
							Signing in...
						} @else {
							Sign In
						}
					</button>
				</form>
			</mcms-card-content>

			<mcms-card-footer class="justify-center">
				<p class="text-sm text-muted-foreground">Momentum CMS</p>
			</mcms-card-footer>
		</mcms-card>
	`,
})
export class LoginPage {
	private readonly auth = inject(MomentumAuthService);
	private readonly router = inject(Router);

	// Form state
	readonly email = signal('');
	readonly password = signal('');
	readonly error = signal<string | null>(null);
	readonly isSubmitting = signal(false);
	readonly touched = signal(false);

	// Validation
	readonly emailErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.email();
		if (!value) return [{ kind: 'required', message: 'Email is required' }];
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			return [{ kind: 'email', message: 'Please enter a valid email' }];
		}
		return [];
	});

	readonly passwordErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.password();
		if (!value) return [{ kind: 'required', message: 'Password is required' }];
		return [];
	});

	readonly isValid = computed(() => {
		return this.email().length > 0 && this.password().length > 0;
	});

	async onSubmit(event: Event): Promise<void> {
		event.preventDefault();
		this.touched.set(true);

		if (!this.isValid() || this.emailErrors().length > 0 || this.passwordErrors().length > 0) {
			return;
		}

		this.isSubmitting.set(true);
		this.error.set(null);

		try {
			const result = await this.auth.signIn(this.email(), this.password());

			if (result.success) {
				await this.router.navigate(['/admin']);
			} else {
				this.error.set(result.error ?? 'Failed to sign in');
			}
		} catch {
			this.error.set('An unexpected error occurred');
		} finally {
			this.isSubmitting.set(false);
		}
	}
}

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
 * Setup Page Component
 *
 * First-time setup page for creating the initial admin user.
 * Only accessible when no users exist in the database.
 */
@Component({
	selector: 'mcms-setup-page',
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
				<mcms-card-title>Welcome to Momentum CMS</mcms-card-title>
				<mcms-card-description> Create your admin account to get started </mcms-card-description>
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

					<mcms-form-field id="name" [required]="true" [errors]="nameErrors()">
						<span mcmsLabel>Full Name</span>
						<mcms-input
							type="text"
							id="name"
							name="name"
							[(value)]="name"
							placeholder="Your name"
							autocomplete="name"
							[disabled]="isSubmitting()"
						/>
					</mcms-form-field>

					<mcms-form-field id="email" [required]="true" [errors]="emailErrors()">
						<span mcmsLabel>Email Address</span>
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
							placeholder="At least 8 characters"
							autocomplete="new-password"
							[disabled]="isSubmitting()"
						/>
					</mcms-form-field>

					<mcms-form-field
						id="confirmPassword"
						[required]="true"
						[errors]="confirmPasswordErrors()"
					>
						<span mcmsLabel>Confirm Password</span>
						<mcms-input
							type="password"
							id="confirmPassword"
							name="confirmPassword"
							[(value)]="confirmPassword"
							placeholder="Repeat your password"
							autocomplete="new-password"
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
							Creating account...
						} @else {
							Create Admin Account
						}
					</button>
				</form>
			</mcms-card-content>

			<mcms-card-footer class="justify-center">
				<p class="text-sm text-muted-foreground">This account will have full admin privileges</p>
			</mcms-card-footer>
		</mcms-card>
	`,
})
export class SetupPage {
	private readonly auth = inject(MomentumAuthService);
	private readonly router = inject(Router);

	// Form state
	readonly name = signal('');
	readonly email = signal('');
	readonly password = signal('');
	readonly confirmPassword = signal('');
	readonly error = signal<string | null>(null);
	readonly isSubmitting = signal(false);
	readonly touched = signal(false);

	// Validation
	readonly nameErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.name();
		if (!value.trim()) return [{ kind: 'required', message: 'Name is required' }];
		return [];
	});

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
		if (value.length < 8) {
			return [{ kind: 'minLength', message: 'Password must be at least 8 characters' }];
		}
		return [];
	});

	readonly confirmPasswordErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.confirmPassword();
		if (!value) return [{ kind: 'required', message: 'Please confirm your password' }];
		if (value !== this.password()) {
			return [{ kind: 'match', message: 'Passwords do not match' }];
		}
		return [];
	});

	readonly isValid = computed(() => {
		return (
			this.name().trim().length > 0 &&
			this.email().length > 0 &&
			this.password().length >= 8 &&
			this.password() === this.confirmPassword()
		);
	});

	async onSubmit(event: Event): Promise<void> {
		event.preventDefault();
		this.touched.set(true);

		// Check all validation
		if (
			!this.isValid() ||
			this.nameErrors().length > 0 ||
			this.emailErrors().length > 0 ||
			this.passwordErrors().length > 0 ||
			this.confirmPasswordErrors().length > 0
		) {
			return;
		}

		this.isSubmitting.set(true);
		this.error.set(null);

		try {
			const result = await this.auth.signUp(
				this.name(),
				this.email(),
				this.password(),
				true, // isFirstUser - creates admin
			);

			if (result.success) {
				// After creating admin, sign in automatically
				const signInResult = await this.auth.signIn(this.email(), this.password());
				if (signInResult.success) {
					await this.router.navigate(['/admin']);
				} else {
					// If auto sign-in fails, redirect to login
					await this.router.navigate(['/admin/login']);
				}
			} else {
				this.error.set(result.error ?? 'Failed to create admin account');
			}
		} catch {
			this.error.set('An unexpected error occurred');
		} finally {
			this.isSubmitting.set(false);
		}
	}
}

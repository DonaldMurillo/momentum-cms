import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	computed,
	output,
} from '@angular/core';
import { Input, Button, FormField } from '@momentum-cms/ui';
import { MomentumAuthService } from '../../services/auth.service';

/**
 * Forgot Password Form Component
 *
 * A reusable form for requesting password reset emails.
 * Can be embedded in any layout or used with the ForgotPasswordPage wrapper.
 *
 * @example
 * ```html
 * <mcms-forgot-password-form
 *   (resetRequested)="onResetRequested($event)"
 *   (backToLogin)="navigateToLogin()"
 * />
 * ```
 */
@Component({
	selector: 'mcms-forgot-password-form',
	imports: [Input, Button, FormField],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<form (submit)="onSubmit($event)" class="space-y-4">
			@if (submitted() && !error()) {
				<div
					class="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400"
					role="status"
					aria-live="polite"
				>
					<p class="font-medium">Check your email</p>
					<p class="mt-1">
						If an account exists for {{ email() }}, you'll receive a password reset link shortly.
					</p>
				</div>
			}

			@if (error()) {
				<div
					class="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
					role="alert"
					aria-live="polite"
				>
					{{ error() }}
				</div>
			}

			@if (!submitted()) {
				<p class="text-sm text-muted-foreground">
					Enter your email address and we'll send you a link to reset your password.
				</p>

				<mcms-form-field id="email" [required]="true" [errors]="emailErrors()">
					<span mcmsLabel>Email</span>
					<mcms-input
						type="email"
						id="email"
						name="email"
						[(value)]="email"
						placeholder="Enter your email address"
						autocomplete="email"
						[disabled]="isSubmitting()"
					/>
				</mcms-form-field>

				<button mcms-button type="submit" class="w-full" [disabled]="isSubmitting() || !isValid()">
					@if (isSubmitting()) {
						<svg
							class="inline-block h-4 w-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
						Sending...
					} @else {
						Send Reset Link
					}
				</button>
			}

			<div class="text-center">
				<button
					type="button"
					class="text-sm text-primary hover:underline"
					(click)="onBackToLogin()"
				>
					Back to Sign In
				</button>
			</div>
		</form>
	`,
})
export class ForgotPasswordFormComponent {
	private readonly auth = inject(MomentumAuthService);

	/** Emitted when reset email has been requested */
	readonly resetRequested = output<string>();

	/** Emitted when user wants to go back to login */
	readonly backToLogin = output<void>();

	// Form state
	readonly email = signal('');
	readonly error = signal<string | null>(null);
	readonly isSubmitting = signal(false);
	readonly submitted = signal(false);
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

	readonly isValid = computed(() => {
		return this.email().length > 0 && this.emailErrors().length === 0;
	});

	async onSubmit(event: Event): Promise<void> {
		event.preventDefault();
		this.touched.set(true);

		if (!this.isValid()) {
			return;
		}

		this.isSubmitting.set(true);
		this.error.set(null);

		try {
			const result = await this.auth.requestPasswordReset(this.email());

			if (result.success) {
				this.submitted.set(true);
				this.resetRequested.emit(this.email());
			} else {
				this.error.set(result.error ?? 'Failed to send reset email');
			}
		} catch {
			this.error.set('An unexpected error occurred');
		} finally {
			this.isSubmitting.set(false);
		}
	}

	onBackToLogin(): void {
		this.backToLogin.emit();
	}
}

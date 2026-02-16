import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	computed,
	input,
	output,
	afterNextRender,
} from '@angular/core';
import { Input, Button, McmsFormField } from '@momentumcms/ui';
import { MomentumAuthService } from '../../services/auth.service';

/**
 * Reset Password Form Component
 *
 * A reusable form for resetting password with a token.
 * Can be embedded in any layout or used with the ResetPasswordPage wrapper.
 *
 * @example
 * ```html
 * <mcms-reset-password-form
 *   [token]="tokenFromUrl"
 *   (resetComplete)="onResetComplete()"
 *   (resetFailed)="onResetFailed($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-reset-password-form',
	imports: [Input, Button, McmsFormField],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<form (submit)="onSubmit($event)" class="space-y-4">
			@if (resetSuccess()) {
				<div
					class="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400"
					role="status"
					aria-live="polite"
				>
					<p class="font-medium">Password reset successful</p>
					<p class="mt-1">
						Your password has been updated. You can now sign in with your new password.
					</p>
				</div>

				<button mcms-button type="button" class="w-full" (click)="onGoToLogin()">
					Go to Sign In
				</button>
			} @else {
				@if (error()) {
					<div
						class="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
						role="alert"
						aria-live="polite"
					>
						{{ error() }}
					</div>
				}

				@if (!token()) {
					<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">
						Invalid or missing reset token. Please request a new password reset link.
					</div>

					<button mcms-button type="button" class="w-full" (click)="onGoToForgotPassword()">
						Request New Link
					</button>
				} @else {
					<p class="text-sm text-muted-foreground">Enter your new password below.</p>

					<mcms-form-field id="password" [required]="true" [errors]="passwordErrors()">
						<span mcmsLabel>New Password</span>
						<mcms-input
							type="password"
							id="password"
							name="password"
							[(value)]="password"
							placeholder="Enter new password"
							autocomplete="new-password"
							[disabled]="!hydrated() || isSubmitting()"
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
							placeholder="Confirm new password"
							autocomplete="new-password"
							[disabled]="!hydrated() || isSubmitting()"
						/>
					</mcms-form-field>

					<button
						mcms-button
						type="submit"
						class="w-full"
						[disabled]="!hydrated() || isSubmitting() || !isValid()"
					>
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
							Resetting...
						} @else {
							Reset Password
						}
					</button>
				}
			}
		</form>
	`,
})
export class ResetPasswordFormComponent {
	private readonly auth = inject(MomentumAuthService);

	/** Whether the component has been hydrated (SSR → client transition complete) */
	readonly hydrated = signal(false);

	constructor() {
		afterNextRender(() => {
			this.hydrated.set(true);
		});
	}

	/** The reset token from the URL */
	readonly token = input<string>('');

	/** Emitted when password reset is complete */
	readonly resetComplete = output<void>();

	/** Emitted when password reset fails */
	readonly resetFailed = output<string>();

	/** Emitted when user wants to go to login */
	readonly goToLogin = output<void>();

	/** Emitted when user wants to request a new reset link */
	readonly goToForgotPassword = output<void>();

	// Form state
	readonly password = signal('');
	readonly confirmPassword = signal('');
	readonly error = signal<string | null>(null);
	readonly isSubmitting = signal(false);
	readonly resetSuccess = signal(false);
	readonly touched = signal(false);

	// Validation
	readonly passwordErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.password();
		if (!value) return [{ kind: 'required', message: 'Password is required' }];
		if (value.length < 8) {
			return [{ kind: 'minlength', message: 'Password must be at least 8 characters' }];
		}
		return [];
	});

	readonly confirmPasswordErrors = computed(() => {
		if (!this.touched()) return [];
		const value = this.confirmPassword();
		if (!value) return [{ kind: 'required', message: 'Please confirm your password' }];
		if (value !== this.password()) {
			return [{ kind: 'mismatch', message: 'Passwords do not match' }];
		}
		return [];
	});

	readonly isValid = computed(() => {
		return (
			this.password().length >= 8 &&
			this.confirmPassword() === this.password() &&
			this.passwordErrors().length === 0 &&
			this.confirmPasswordErrors().length === 0
		);
	});

	async onSubmit(event: Event): Promise<void> {
		event.preventDefault();
		this.touched.set(true);

		if (!this.isValid() || !this.token()) {
			return;
		}

		this.isSubmitting.set(true);
		this.error.set(null);

		try {
			const result = await this.auth.resetPassword(this.token(), this.password());

			if (result.success) {
				this.resetSuccess.set(true);
				this.resetComplete.emit();
			} else {
				const errorMessage = result.error ?? 'Failed to reset password';
				this.error.set(errorMessage);
				this.resetFailed.emit(errorMessage);
			}
		} catch {
			const errorMessage = 'An unexpected error occurred';
			this.error.set(errorMessage);
			this.resetFailed.emit(errorMessage);
		} finally {
			this.isSubmitting.set(false);
		}
	}

	onGoToLogin(): void {
		this.goToLogin.emit();
	}

	onGoToForgotPassword(): void {
		this.goToForgotPassword.emit();
	}
}

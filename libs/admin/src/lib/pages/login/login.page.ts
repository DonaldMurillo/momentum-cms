import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	computed,
	OnInit,
	afterNextRender,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
	Input,
	Button,
	McmsFormField,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '@momentumcms/ui';
import { MomentumAuthService } from '../../services/auth.service';

/**
 * Login Page Component
 *
 * Allows users to sign in with email and password, or via OAuth providers.
 */
@Component({
	selector: 'mcms-login-page',
	imports: [
		RouterLink,
		Input,
		Button,
		McmsFormField,
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
		<main>
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

						<mcms-form-field id="login-email" [required]="true" [errors]="emailErrors()">
							<span mcmsLabel>Email</span>
							<mcms-input
								type="email"
								id="login-email"
								name="email"
								[(value)]="email"
								placeholder="admin@example.com"
								autocomplete="email"
								[disabled]="!hydrated() || isSubmitting()"
							/>
						</mcms-form-field>

						<mcms-form-field id="login-password" [required]="true" [errors]="passwordErrors()">
							<span mcmsLabel>Password</span>
							<mcms-input
								type="password"
								id="login-password"
								name="password"
								[(value)]="password"
								placeholder="Enter your password"
								autocomplete="current-password"
								[disabled]="!hydrated() || isSubmitting()"
							/>
						</mcms-form-field>

						<div class="flex justify-end">
							<a routerLink="/admin/forgot-password" class="text-sm text-primary hover:underline">
								Forgot your password?
							</a>
						</div>

						<button
							mcms-button
							type="submit"
							class="w-full"
							[disabled]="!hydrated() || isSubmitting() || !isValid()"
						>
							@if (isSubmitting()) {
								<span class="animate-spin" aria-hidden="true">⏳</span>
								Signing in...
							} @else {
								Sign In
							}
						</button>
					</form>

					@if (oauthProviders().length > 0) {
						<div class="relative my-4">
							<div class="absolute inset-0 flex items-center">
								<span class="w-full border-t border-border"></span>
							</div>
							<div class="relative flex justify-center text-xs uppercase">
								<span class="bg-card px-2 text-muted-foreground">Or continue with</span>
							</div>
						</div>

						<div class="flex flex-col gap-2">
							@for (provider of oauthProviders(); track provider) {
								<button
									mcms-button
									type="button"
									variant="outline"
									class="w-full"
									(click)="signInWithOAuth(provider)"
									[disabled]="!hydrated() || isSubmitting()"
									[attr.data-provider]="provider"
								>
									@switch (provider) {
										@case ('google') {
											<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
												<path
													d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
													fill="#4285F4"
												/>
												<path
													d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
													fill="#34A853"
												/>
												<path
													d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
													fill="#FBBC05"
												/>
												<path
													d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
													fill="#EA4335"
												/>
											</svg>
											Continue with Google
										}
										@case ('github') {
											<svg
												class="mr-2 h-4 w-4"
												viewBox="0 0 24 24"
												fill="currentColor"
												aria-hidden="true"
											>
												<path
													d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
												/>
											</svg>
											Continue with GitHub
										}
										@default {
											Continue with {{ provider }}
										}
									}
								</button>
							}
						</div>
					}
				</mcms-card-content>

				<mcms-card-footer class="justify-center">
					<p class="text-sm text-muted-foreground">Momentum CMS</p>
				</mcms-card-footer>
			</mcms-card>
		</main>
	`,
})
export class LoginPage implements OnInit {
	private readonly auth = inject(MomentumAuthService);
	private readonly router = inject(Router);

	/** Whether the component has been hydrated (SSR → client transition complete) */
	readonly hydrated = signal(false);

	constructor() {
		afterNextRender(() => {
			this.hydrated.set(true);
		});
	}

	// Form state
	readonly email = signal('');
	readonly password = signal('');
	readonly error = signal<string | null>(null);
	readonly isSubmitting = signal(false);
	readonly touched = signal(false);

	// OAuth providers
	readonly oauthProviders = signal<string[]>([]);

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

	async ngOnInit(): Promise<void> {
		const providers = await this.auth.getOAuthProviders();
		this.oauthProviders.set(providers);
	}

	signInWithOAuth(provider: string): void {
		this.auth.signInWithOAuth(provider);
	}

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

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Response type for the setup status endpoint.
 */
export interface SetupStatus {
	/** True if no users exist and setup is required */
	needsSetup: boolean;
	/** True if at least one user exists */
	hasUsers: boolean;
}

/**
 * User data returned from Better Auth.
 */
export interface AuthUser {
	id: string;
	email: string;
	name: string;
	role: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Session data from Better Auth.
 */
export interface AuthSession {
	id: string;
	userId: string;
	token: string;
	expiresAt: string;
}

/**
 * Response from Better Auth session endpoint.
 */
interface SessionResponse {
	user: AuthUser | null;
	session: AuthSession | null;
}

/**
 * Response from Better Auth sign-in/sign-up endpoints.
 */
interface AuthResponse {
	user?: AuthUser;
	session?: AuthSession;
	error?: {
		message: string;
		code?: string;
		status?: number;
	};
}

/**
 * Result type for auth operations.
 */
export interface AuthResult {
	success: boolean;
	error?: string;
	user?: AuthUser;
}

/**
 * Momentum Auth Service
 *
 * Manages authentication state using signals and communicates with Better Auth
 * endpoints on the server.
 *
 * @example
 * ```typescript
 * const auth = inject(MomentumAuthService);
 *
 * // Check if authenticated
 * if (auth.isAuthenticated()) {
 *   console.log('User:', auth.user()?.name);
 * }
 *
 * // Sign in
 * const result = await auth.signIn('user@example.com', 'password');
 * if (!result.success) {
 *   console.error(result.error);
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class MomentumAuthService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = '/api/auth';

	// === Writable signals (internal state) ===

	/** Current authenticated user */
	readonly user = signal<AuthUser | null>(null);

	/** Whether auth state is being loaded */
	readonly loading = signal(true);

	/** Whether the app needs initial setup (no users exist) */
	readonly needsSetup = signal(false);

	// === Computed signals (derived state) ===

	/** Whether a user is currently authenticated */
	readonly isAuthenticated = computed(() => this.user() !== null);

	/** Current user's role */
	readonly role = computed(() => this.user()?.role ?? null);

	/** Whether current user is an admin */
	readonly isAdmin = computed(() => this.role() === 'admin');

	/** Tracks in-flight initialization to prevent duplicate requests */
	private initPromise: Promise<void> | null = null;

	/**
	 * Initialize auth state by checking current session.
	 * Should be called on app startup. Safe to call concurrently from multiple guards.
	 */
	async initialize(): Promise<void> {
		// Return existing promise if initialization is already in progress
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = this.doInitialize();
		try {
			await this.initPromise;
		} finally {
			this.initPromise = null;
		}
	}

	private async doInitialize(): Promise<void> {
		this.loading.set(true);
		try {
			// Check setup status first
			const setupStatus = await this.checkSetupStatus();
			this.needsSetup.set(setupStatus.needsSetup);

			// Only check session if setup is complete
			if (!setupStatus.needsSetup) {
				await this.refreshSession();
			}
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Check if the application needs initial setup (no users exist).
	 */
	async checkSetupStatus(): Promise<SetupStatus> {
		try {
			const response = await firstValueFrom(this.http.get<SetupStatus>('/api/setup/status'));
			return response;
		} catch {
			// If endpoint fails, assume setup is needed
			return { needsSetup: true, hasUsers: false };
		}
	}

	/**
	 * Refresh the current session from the server.
	 */
	async refreshSession(): Promise<AuthUser | null> {
		try {
			const response = await firstValueFrom(
				this.http.get<SessionResponse>(`${this.baseUrl}/get-session`, {
					withCredentials: true,
				}),
			);

			if (response.user) {
				this.user.set(response.user);
				return response.user;
			}

			this.user.set(null);
			return null;
		} catch {
			this.user.set(null);
			return null;
		}
	}

	/**
	 * Sign in with email and password.
	 */
	async signIn(email: string, password: string): Promise<AuthResult> {
		try {
			const response = await firstValueFrom(
				this.http.post<AuthResponse>(
					`${this.baseUrl}/sign-in/email`,
					{ email, password },
					{ withCredentials: true },
				),
			);

			if (response.error) {
				return { success: false, error: response.error.message };
			}

			if (response.user) {
				this.user.set(response.user);
				return { success: true, user: response.user };
			}

			return { success: false, error: 'Unknown error occurred' };
		} catch (error) {
			const message = this.extractErrorMessage(error);
			return { success: false, error: message };
		}
	}

	/**
	 * Sign up a new user with email and password.
	 *
	 * @param name User's display name
	 * @param email User's email address
	 * @param password User's password (min 8 characters)
	 * @param isFirstUser If true, grants admin role (for setup flow)
	 */
	async signUp(
		name: string,
		email: string,
		password: string,
		isFirstUser = false,
	): Promise<AuthResult> {
		try {
			// For first user, use the special setup endpoint
			const endpoint = isFirstUser ? '/api/setup/create-admin' : `${this.baseUrl}/sign-up/email`;

			const response = await firstValueFrom(
				this.http.post<AuthResponse>(
					endpoint,
					{ name, email, password },
					{ withCredentials: true },
				),
			);

			if (response.error) {
				return { success: false, error: response.error.message };
			}

			if (response.user) {
				this.user.set(response.user);
				this.needsSetup.set(false);
				return { success: true, user: response.user };
			}

			return { success: false, error: 'Unknown error occurred' };
		} catch (error) {
			const message = this.extractErrorMessage(error);
			return { success: false, error: message };
		}
	}

	/**
	 * Sign out the current user.
	 */
	async signOut(): Promise<void> {
		try {
			await firstValueFrom(
				this.http.post(`${this.baseUrl}/sign-out`, {}, { withCredentials: true }),
			);
		} finally {
			this.user.set(null);
		}
	}

	/**
	 * Extract error message from HTTP error response.
	 */
	private extractErrorMessage(error: unknown): string {
		if (this.isHttpErrorWithMessage(error)) {
			return error.error.message;
		}
		return 'An unexpected error occurred';
	}

	/**
	 * Type guard for HTTP error responses with message.
	 */
	private isHttpErrorWithMessage(error: unknown): error is { error: { message: string } } {
		return (
			error !== null &&
			typeof error === 'object' &&
			'error' in error &&
			error.error !== null &&
			typeof error.error === 'object' &&
			'message' in error.error &&
			typeof error.error.message === 'string'
		);
	}
}

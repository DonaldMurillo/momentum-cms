/**
 * Shared test utilities for field renderer tests.
 */
import { signal } from '@angular/core';
import type { Field } from '@momentumcms/core';
import type { FieldNodeState } from '../../entity-form.types';

/**
 * Create a mock FieldNodeState with writable signals for testing.
 */
export function createMockFieldNodeState(
	initialValue: unknown = '',
	options?: {
		errors?: ReadonlyArray<{ kind: string; message?: string }>;
		touched?: boolean;
		dirty?: boolean;
		invalid?: boolean;
	},
): { state: FieldNodeState; node: () => FieldNodeState } {
	const state: FieldNodeState = {
		value: signal(initialValue),
		errors: signal(options?.errors ?? []),
		touched: signal(options?.touched ?? false),
		dirty: signal(options?.dirty ?? false),
		invalid: signal(options?.invalid ?? false),
		markAsTouched: vi.fn(),
		reset: vi.fn(),
	};

	// FieldTree nodes are callable functions that return the FieldState
	const node = (): FieldNodeState => state;

	return { state, node };
}

/**
 * Create a mock Field definition for testing.
 */
export function createMockField(type: string, overrides?: Partial<Field>): Field {
	const base: Record<string, unknown> = {
		name: overrides?.name ?? 'testField',
		type,
		label: overrides?.label ?? 'Test Field',
		required: overrides?.required ?? false,
		...overrides,
	};
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return base as unknown as Field;
}

/**
 * Create a mock MomentumAuthService with all methods as vi.fn().
 */
export function createMockAuthService(): Record<string, ReturnType<typeof vi.fn>> {
	return {
		signIn: vi.fn().mockResolvedValue({ success: true }),
		signUp: vi.fn().mockResolvedValue({ success: true }),
		signOut: vi.fn().mockResolvedValue(undefined),
		getOAuthProviders: vi.fn().mockResolvedValue([]),
		signInWithOAuth: vi.fn(),
		getSession: vi.fn().mockResolvedValue(null),
		requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
		resetPassword: vi.fn().mockResolvedValue({ success: true }),
	};
}

import { computed, type InputSignal, type Signal, type WritableSignal } from '@angular/core';
import type { ValidationError } from '@momentumcms/ui';
import type { FormFieldConfig } from '../types/form-schema.types';

/**
 * Minimal interface for accessing state from a Signal Forms FieldTree node.
 * FieldTree nodes are callable — calling one returns its FieldState.
 */
export interface FieldNodeState {
	readonly value: WritableSignal<unknown>;
	readonly errors: Signal<ReadonlyArray<{ kind: string; message?: string }>>;
	readonly touched: Signal<boolean>;
	markAsTouched(): void;
}

/**
 * Safely extract FieldState from a FieldTree node.
 *
 * FieldTree nodes are callable functions — invoking returns the FieldState.
 */
export function getFieldNodeState(formNode: unknown): FieldNodeState | null {
	if (formNode == null || typeof formNode !== 'function') return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- FieldTree nodes are callable but untyped from our perspective
	return (formNode as () => FieldNodeState)();
}

/**
 * Shared computed signals used by most form field renderers.
 *
 * Eliminates duplication across text, textarea, email, number, date,
 * select, radio, and checkbox field components.
 */
export function createFieldNodeSignals(
	field: InputSignal<FormFieldConfig>,
	formNode: InputSignal<unknown>,
): {
	readonly nodeState: Signal<FieldNodeState | null>;
	readonly fieldId: Signal<string>;
	readonly stringValue: Signal<string>;
	readonly touchedErrors: Signal<readonly ValidationError[]>;
} {
	const nodeState = computed(() => getFieldNodeState(formNode()));
	const fieldId = computed(() => `form-field-${field().name}`);
	const stringValue = computed(() => {
		const state = nodeState();
		if (!state) return '';
		const val = state.value();
		return val === null || val === undefined ? '' : String(val);
	});
	const touchedErrors = computed((): readonly ValidationError[] => {
		const state = nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	return { nodeState, fieldId, stringValue, touchedErrors } as const;
}

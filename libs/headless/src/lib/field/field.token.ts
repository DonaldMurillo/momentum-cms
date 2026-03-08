import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';

export interface HdlFieldContext {
	readonly controlId: Signal<string | null>;
	readonly describedBy: Signal<string | null>;
	readonly errorId: Signal<string | null>;
	readonly invalid: Signal<boolean>;
	readonly disabled: Signal<boolean>;
	readonly required: Signal<boolean>;
	defaultControlId(): string;
	registerControl(id: string): void;
	unregisterControl(id: string): void;
	registerDescription(id: string): void;
	unregisterDescription(id: string): void;
	registerError(id: string): void;
	unregisterError(id: string): void;
}

export const HDL_FIELD_CONTEXT = new InjectionToken<HdlFieldContext>('HDL_FIELD_CONTEXT');

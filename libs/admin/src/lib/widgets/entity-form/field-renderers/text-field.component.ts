/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow Field union to TextField/TextareaField after type guard */

import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { McmsFormField, Input, Textarea } from '@momentumcms/ui';
import type { ValidationError } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field, TextField, TextareaField } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';

/**
 * Text field renderer for text and textarea field types.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-text-field-renderer',
	imports: [McmsFormField, Input, Textarea],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[for]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			@if (isTextarea()) {
				<mcms-textarea
					[id]="fieldId()"
					[value]="displayValue()"
					[placeholder]="placeholder()"
					[disabled]="isDisabled()"
					[rows]="rows()"
					[errors]="touchedErrors()"
					(valueChange)="onValueChange($event)"
					(blurred)="onBlur()"
				/>
			} @else {
				<mcms-input
					[id]="fieldId()"
					[type]="inputType()"
					[value]="displayValue()"
					[placeholder]="placeholder()"
					[disabled]="isDisabled()"
					[errors]="touchedErrors()"
					(valueChange)="onValueChange($event)"
					(blurred)="onBlur()"
				/>
			}
			@if (description()) {
				<p class="mt-1 text-xs text-muted-foreground">{{ description() }}</p>
			}
			@if (showCharCount()) {
				<p
					class="mt-1 text-xs text-right"
					[class.text-destructive]="charCountExceeded()"
					[class.text-muted-foreground]="!charCountExceeded()"
					aria-live="polite"
					[attr.role]="charCountExceeded() ? 'alert' : null"
				>
					@if (charCountExceeded()) {
						Limit exceeded:
					}
					{{ charCount() }}
					@if (maxLength()) {
						/ {{ maxLength() }}
					}
				</p>
			}
		</mcms-form-field>
	`,
})
export class TextFieldRenderer {
	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Whether the field is required */
	readonly required = computed(() => this.field().required ?? false);

	/** Placeholder text */
	readonly placeholder = computed(() => this.field().admin?.placeholder || '');

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Whether to use textarea — true for explicit textarea fields, JSON/object fields,
	 * and any field whose serialized value spans multiple lines. */
	readonly isTextarea = computed(() => {
		if (this.field().type === 'textarea' || this.field().type === 'json') return true;
		const state = this.nodeState();
		const val = state?.value();
		if (val && typeof val === 'object') return true;
		return false;
	});

	/** Input type (text, email, etc.) */
	readonly inputType = computed(() => {
		return this.field().type === 'email' ? 'email' : 'text';
	});

	/** Number of rows for textarea */
	readonly rows = computed(() => {
		return 4;
	});

	/** String value from FieldState. Objects/arrays are serialized to JSON so they
	 * don't render as the useless "[object Object]" coercion. */
	readonly stringValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		if (val === null || val === undefined) return '';
		if (typeof val === 'object') {
			try {
				return JSON.stringify(val, null, 2);
			} catch {
				return '';
			}
		}
		return String(val);
	});

	/** Holds the user's exact text while editing a JSON/object field. Without it,
	 * each successful parse round-trips through JSON.stringify and rewrites the
	 * textarea (jumping the caret, erasing whitespace) on every keystroke. The
	 * buffer is cleared on blur once the text parses cleanly. */
	private readonly editBuffer = signal<string | null>(null);

	/** What the input/textarea actually shows. Prefers the in-flight edit buffer
	 * (set during JSON editing) over the canonical pretty-printed stringValue. */
	readonly displayValue = computed(() => {
		const buf = this.editBuffer();
		return buf !== null ? buf : this.stringValue();
	});

	/** Field description */
	readonly description = computed(() => this.field().description ?? '');

	/** Max length from field constraints */
	readonly maxLength = computed((): number | undefined => {
		const f = this.field();
		if (f.type === 'text' || f.type === 'textarea') {
			return (f as TextField | TextareaField).maxLength;
		}
		return undefined;
	});

	/** Current character count */
	readonly charCount = computed(() => this.stringValue().length);

	/** Whether to show character counter */
	readonly showCharCount = computed(() => this.maxLength() !== undefined);

	/** Whether character count exceeds max */
	readonly charCountExceeded = computed(() => {
		const max = this.maxLength();
		return max !== undefined && this.charCount() > max;
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	/**
	 * Handle value change from input/textarea. For JSON fields and fields whose
	 * underlying value is an object, parse the string back into the form model so
	 * the saved payload preserves shape. The user's exact typed text is held in
	 * the editBuffer so the textarea isn't reformatted mid-edit. If parse fails,
	 * the last-parsed object remains in state — partial strings never demote the
	 * field's value.
	 */
	onValueChange(value: string): void {
		const state = this.nodeState();
		if (!state) return;
		const f = this.field();
		const wasObject = typeof state.value() === 'object' && state.value() !== null;
		if (f.type === 'json' || wasObject) {
			this.editBuffer.set(value);
			try {
				state.value.set(JSON.parse(value));
			} catch {
				/* keep last-parsed value in state until input parses cleanly */
			}
			return;
		}
		state.value.set(value);
	}

	/**
	 * Handle blur from input/textarea. Marks the field as touched and, for JSON
	 * fields, drops the edit buffer so the textarea reverts to canonical
	 * pretty-printed output — but only if the buffer is valid JSON. Invalid text
	 * is preserved on blur so the user can see and fix what they typed.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
		const buf = this.editBuffer();
		if (buf === null) return;
		try {
			JSON.parse(buf);
			this.editBuffer.set(null);
		} catch {
			/* keep showing the user's invalid text so they can correct it */
		}
	}
}

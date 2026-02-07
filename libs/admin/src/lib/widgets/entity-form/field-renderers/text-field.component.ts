import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Input, Textarea } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import { humanizeFieldName } from '@momentum-cms/core';
import type { Field, TextField, TextareaField } from '@momentum-cms/core';
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
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			@if (isTextarea()) {
				<mcms-textarea
					[id]="fieldId()"
					[value]="stringValue()"
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
					[value]="stringValue()"
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
				<p class="mt-1 text-xs text-muted-foreground text-right" [class.text-destructive]="charCountExceeded()">
					{{ charCount() }}@if (maxLength()) { / {{ maxLength() }}}
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

	/** Whether to use textarea */
	readonly isTextarea = computed(() => {
		return this.field().type === 'textarea';
	});

	/** Input type (text, email, etc.) */
	readonly inputType = computed(() => {
		return this.field().type === 'email' ? 'email' : 'text';
	});

	/** Number of rows for textarea */
	readonly rows = computed(() => {
		return 4;
	});

	/** String value from FieldState */
	readonly stringValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		return val === null || val === undefined ? '' : String(val);
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
	 * Handle value change from input/textarea.
	 */
	onValueChange(value: string): void {
		const state = this.nodeState();
		if (state) state.value.set(value);
	}

	/**
	 * Handle blur from input/textarea.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
	}
}

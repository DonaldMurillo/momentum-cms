import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormField, Input, Textarea } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';

/**
 * Text field renderer for text and textarea field types.
 */
@Component({
	selector: 'mcms-text-field-renderer',
	imports: [FormField, Input, Textarea],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="fieldErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			@if (isTextarea()) {
				<mcms-textarea
					[id]="fieldId()"
					[value]="stringValue()"
					[placeholder]="placeholder()"
					[disabled]="isDisabled()"
					[rows]="rows()"
					[errors]="fieldErrors()"
					(valueChange)="onValueChange($event)"
				/>
			} @else {
				<mcms-input
					[id]="fieldId()"
					[type]="inputType()"
					[value]="stringValue()"
					[placeholder]="placeholder()"
					[disabled]="isDisabled()"
					[errors]="fieldErrors()"
					(valueChange)="onValueChange($event)"
				/>
			}
		</mcms-form-field>
	`,
})
export class TextFieldRenderer {
	/** Field definition */
	readonly field = input.required<Field>();

	/** Current value */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

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
		return this.field().type === 'textarea' || this.field().type === 'richText';
	});

	/** Input type (text, email, etc.) */
	readonly inputType = computed(() => {
		return this.field().type === 'email' ? 'email' : 'text';
	});

	/** Number of rows for textarea */
	readonly rows = computed(() => {
		return this.field().type === 'richText' ? 10 : 4;
	});

	/** String value for input */
	readonly stringValue = computed(() => {
		const val = this.value();
		return val === null || val === undefined ? '' : String(val);
	});

	/** Convert error string to ValidationError array */
	readonly fieldErrors = computed((): readonly ValidationError[] => {
		const err = this.error();
		if (!err) return [];
		return [{ kind: 'custom', message: err }];
	});

	/**
	 * Handle value change from input/textarea.
	 */
	onValueChange(value: string): void {
		this.fieldChange.emit({
			path: this.path(),
			value: value,
		});
	}
}

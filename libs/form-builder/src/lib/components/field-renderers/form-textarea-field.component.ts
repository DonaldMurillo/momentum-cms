import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { McmsFormField, Textarea } from '@momentumcms/ui';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { createFieldNodeSignals } from '../form-field-helpers';

@Component({
	selector: 'mcms-form-textarea-field',
	imports: [McmsFormField, Textarea],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="field().required ?? false"
			[errors]="touchedErrors()"
		>
			@if (field().label) {
				<span mcmsLabel>{{ field().label }}</span>
			}
			<mcms-textarea
				[id]="fieldId()"
				[name]="field().name"
				[value]="stringValue()"
				[placeholder]="field().placeholder ?? ''"
				[disabled]="field().disabled ?? false"
				[rows]="field().rows ?? 4"
				[errors]="touchedErrors()"
				(valueChange)="onValueChange($event)"
				(blurred)="onBlur()"
			/>
		</mcms-form-field>
	`,
})
export class FormTextareaFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	private readonly fs = createFieldNodeSignals(this.field, this.formNode);
	readonly fieldId = this.fs.fieldId;
	readonly stringValue = this.fs.stringValue;
	readonly touchedErrors = this.fs.touchedErrors;

	onValueChange(value: string): void {
		this.fs.nodeState()?.value.set(value);
	}

	onBlur(): void {
		this.fs.nodeState()?.markAsTouched();
	}
}

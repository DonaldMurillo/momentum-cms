import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { McmsFormField, Input } from '@momentumcms/ui';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { createFieldNodeSignals } from '../form-field-helpers';

@Component({
	selector: 'mcms-form-number-field',
	imports: [McmsFormField, Input],
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
			<mcms-input
				[id]="fieldId()"
				type="number"
				[value]="stringValue()"
				[placeholder]="field().placeholder ?? ''"
				[disabled]="field().disabled ?? false"
				[min]="field().min"
				[max]="field().max"
				[step]="field().step"
				[errors]="touchedErrors()"
				(valueChange)="onValueChange($event)"
				(blurred)="onBlur()"
			/>
		</mcms-form-field>
	`,
})
export class FormNumberFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	private readonly fs = createFieldNodeSignals(this.field, this.formNode);
	readonly fieldId = this.fs.fieldId;
	readonly stringValue = this.fs.stringValue;
	readonly touchedErrors = this.fs.touchedErrors;

	onValueChange(value: string): void {
		const parsed = value === '' ? null : Number(value);
		this.fs.nodeState()?.value.set(parsed);
	}

	onBlur(): void {
		this.fs.nodeState()?.markAsTouched();
	}
}

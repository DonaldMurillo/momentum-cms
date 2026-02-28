import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Select } from '@momentumcms/ui';
import type { SelectOption } from '@momentumcms/ui';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { createFieldNodeSignals } from '../form-field-helpers';

@Component({
	selector: 'mcms-form-select-field',
	imports: [McmsFormField, Select],
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
			<mcms-select
				[id]="fieldId()"
				[name]="field().name"
				[value]="stringValue()"
				[placeholder]="field().placeholder ?? 'Select...'"
				[disabled]="field().disabled ?? false"
				[options]="selectOptions()"
				[errors]="touchedErrors()"
				(valueChange)="onValueChange($event)"
				(blurred)="onBlur()"
			/>
		</mcms-form-field>
	`,
})
export class FormSelectFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	private readonly fs = createFieldNodeSignals(this.field, this.formNode);
	readonly fieldId = this.fs.fieldId;
	readonly stringValue = this.fs.stringValue;
	readonly touchedErrors = this.fs.touchedErrors;

	readonly selectOptions = computed((): SelectOption[] => {
		return (this.field().options ?? []).map((opt) => ({
			label: opt.label,
			value: String(opt.value),
		}));
	});

	onValueChange(value: string): void {
		this.fs.nodeState()?.value.set(value);
	}

	onBlur(): void {
		this.fs.nodeState()?.markAsTouched();
	}
}

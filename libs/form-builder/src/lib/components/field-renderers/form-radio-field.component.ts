import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { McmsFormField } from '@momentumcms/ui';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { createFieldNodeSignals } from '../form-field-helpers';

@Component({
	selector: 'mcms-form-radio-field',
	imports: [McmsFormField],
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
			<div
				class="flex flex-col gap-2"
				role="radiogroup"
				[attr.aria-label]="field().label ?? field().name"
			>
				@for (option of field().options ?? []; track option.value) {
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							[name]="field().name"
							[value]="option.value"
							[checked]="stringValue() === String(option.value)"
							[disabled]="field().disabled ?? false"
							(change)="onValueChange(option.value)"
							class="h-4 w-4 text-primary border-input"
						/>
						<span class="text-sm">{{ option.label }}</span>
					</label>
				}
			</div>
		</mcms-form-field>
	`,
})
export class FormRadioFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	protected readonly String = String;

	private readonly fs = createFieldNodeSignals(this.field, this.formNode);
	readonly fieldId = this.fs.fieldId;
	readonly stringValue = this.fs.stringValue;
	readonly touchedErrors = this.fs.touchedErrors;

	onValueChange(value: string | number): void {
		const state = this.fs.nodeState();
		if (state) {
			state.value.set(value);
			state.markAsTouched();
		}
	}
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Checkbox } from '@momentumcms/ui';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { createFieldNodeSignals } from '../form-field-helpers';

@Component({
	selector: 'mcms-form-checkbox-field',
	imports: [McmsFormField, Checkbox],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="field().required ?? false"
			[errors]="touchedErrors()"
			[hasLabel]="false"
		>
			<div class="flex items-center gap-2">
				<mcms-checkbox
					[id]="fieldId()"
					[value]="boolValue()"
					[disabled]="field().disabled ?? false"
					(valueChange)="onCheckedChange($event)"
				/>
				@if (field().label) {
					<label [for]="fieldId()" class="text-sm font-medium leading-none cursor-pointer">
						{{ field().label }}
					</label>
				}
			</div>
		</mcms-form-field>
	`,
})
export class FormCheckboxFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	private readonly fs = createFieldNodeSignals(this.field, this.formNode);
	readonly fieldId = this.fs.fieldId;
	readonly touchedErrors = this.fs.touchedErrors;

	readonly boolValue = computed(() => {
		const state = this.fs.nodeState();
		return state ? !!state.value() : false;
	});

	onCheckedChange(checked: boolean): void {
		const state = this.fs.nodeState();
		if (state) {
			state.value.set(checked);
			state.markAsTouched();
		}
	}
}

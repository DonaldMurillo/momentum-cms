import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FormFieldConfig } from '../../types/form-schema.types';

/**
 * Hidden field renderer — renders nothing visually.
 * The value is held in the signal form model.
 */
@Component({
	selector: 'mcms-form-hidden-field',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: ``,
})
export class FormHiddenFieldComponent {
	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);
}

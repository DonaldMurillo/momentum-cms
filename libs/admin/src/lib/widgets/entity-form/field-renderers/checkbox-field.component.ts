import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormField, Checkbox } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';

/**
 * Checkbox field renderer.
 */
@Component({
	selector: 'mcms-checkbox-field-renderer',
	imports: [FormField, Checkbox],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field [id]="fieldId()" [hasLabel]="false" [errors]="fieldErrors()">
			<mcms-checkbox
				[id]="fieldId()"
				[value]="boolValue()"
				[disabled]="isDisabled()"
				[errors]="fieldErrors()"
				(valueChange)="onValueChange($event)"
			>
				{{ label() }}
				@if (required()) {
					<span class="text-destructive ml-1">*</span>
				}
			</mcms-checkbox>
			@if (description()) {
				<p class="text-sm text-muted-foreground mt-1">{{ description() }}</p>
			}
		</mcms-form-field>
	`,
})
export class CheckboxFieldRenderer {
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

	/** Field description */
	readonly description = computed(() => this.field().description || '');

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Boolean value for checkbox */
	readonly boolValue = computed(() => {
		const val = this.value();
		return val === true || val === 'true';
	});

	/** Convert error string to ValidationError array */
	readonly fieldErrors = computed((): readonly ValidationError[] => {
		const err = this.error();
		if (!err) return [];
		return [{ kind: 'custom', message: err }];
	});

	/**
	 * Handle value change from checkbox.
	 */
	onValueChange(value: boolean): void {
		this.fieldChange.emit({
			path: this.path(),
			value,
		});
	}
}

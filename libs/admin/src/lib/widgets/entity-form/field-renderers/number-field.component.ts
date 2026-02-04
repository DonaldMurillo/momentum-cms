import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormField, Input } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';

/**
 * Number field renderer.
 */
@Component({
	selector: 'mcms-number-field-renderer',
	imports: [FormField, Input],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="fieldErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			<mcms-input
				[id]="fieldId()"
				type="number"
				[value]="stringValue()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="fieldErrors()"
				(valueChange)="onValueChange($event)"
			/>
		</mcms-form-field>
	`,
})
export class NumberFieldRenderer {
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
	 * Handle value change from input.
	 */
	onValueChange(value: string): void {
		const numValue = value === '' ? null : Number(value);
		this.fieldChange.emit({
			path: this.path(),
			value: Number.isNaN(numValue) ? null : numValue,
		});
	}
}

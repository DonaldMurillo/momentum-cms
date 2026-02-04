import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormField, Select } from '@momentum-cms/ui';
import type { ValidationError, SelectOption } from '@momentum-cms/ui';
import type { Field, SelectField as SelectFieldType } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';

/**
 * Select field renderer.
 */
@Component({
	selector: 'mcms-select-field-renderer',
	imports: [FormField, Select],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="fieldErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			<mcms-select
				[id]="fieldId()"
				[value]="stringValue()"
				[options]="selectOptions()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="fieldErrors()"
				(valueChange)="onValueChange($event)"
			/>
		</mcms-form-field>
	`,
})
export class SelectFieldRenderer {
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
	readonly placeholder = computed(() => this.field().admin?.placeholder || 'Select...');

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Select options (converted to UI SelectOption format with string values) */
	readonly selectOptions = computed((): SelectOption[] => {
		// This component is only used for select/radio fields
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const f = this.field() as SelectFieldType;
		const options = f.options || [];
		return options.map((opt) => ({
			label: opt.label,
			value: String(opt.value),
		}));
	});

	/** String value for select */
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
	 * Handle value change from select.
	 */
	onValueChange(value: string): void {
		this.fieldChange.emit({
			path: this.path(),
			value: value || null,
		});
	}
}

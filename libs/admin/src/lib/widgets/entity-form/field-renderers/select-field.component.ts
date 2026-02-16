import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Select } from '@momentumcms/ui';
import type { ValidationError, SelectOption } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field, SelectField as SelectFieldType } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';

/**
 * Select field renderer.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-select-field-renderer',
	imports: [McmsFormField, Select],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			<mcms-select
				[id]="fieldId()"
				[value]="stringValue()"
				[options]="selectOptions()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="touchedErrors()"
				(valueChange)="onValueChange($event)"
			/>
		</mcms-form-field>
	`,
})
export class SelectFieldRenderer {
	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

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

	/** String value from FieldState */
	readonly stringValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		return val === null || val === undefined ? '' : String(val);
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	/**
	 * Handle value change from select.
	 * Marks touched immediately since select has no native blur flow.
	 */
	onValueChange(value: string): void {
		const state = this.nodeState();
		if (!state) return;
		state.value.set(value || null);
		state.markAsTouched();
	}
}

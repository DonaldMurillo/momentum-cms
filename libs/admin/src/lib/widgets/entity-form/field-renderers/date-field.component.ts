import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Input } from '@momentumcms/ui';
import type { ValidationError } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';

/**
 * Date field renderer.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-date-field-renderer',
	imports: [McmsFormField, Input],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>
			<mcms-input
				[id]="fieldId()"
				[type]="inputType()"
				[value]="dateValue()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="touchedErrors()"
				(valueChange)="onValueChange($event)"
				(blurred)="onBlur()"
			/>
		</mcms-form-field>
	`,
})
export class DateFieldRenderer {
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
	readonly placeholder = computed(() => this.field().admin?.placeholder || '');

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Input type (date or datetime-local) */
	readonly inputType = computed((): 'date' | 'datetime-local' => {
		return 'date';
	});

	/** Formatted date value from FieldState */
	readonly dateValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		if (val === null || val === undefined || val === '') {
			return '';
		}

		try {
			// Date constructor accepts string or number
			const dateInput = typeof val === 'number' ? val : String(val);
			const date = new Date(dateInput);
			if (Number.isNaN(date.getTime())) {
				return '';
			}
			// Format as YYYY-MM-DD for date input
			return date.toISOString().split('T')[0];
		} catch {
			return '';
		}
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	/**
	 * Handle value change from input.
	 */
	onValueChange(value: string): void {
		const state = this.nodeState();
		if (!state) return;

		if (!value) {
			state.value.set(null);
			return;
		}

		// Convert to ISO string
		try {
			const date = new Date(value);
			state.value.set(date.toISOString());
		} catch {
			state.value.set(null);
		}
	}

	/**
	 * Handle blur from input.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
	}
}

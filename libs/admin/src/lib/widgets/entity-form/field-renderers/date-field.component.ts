import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormField, Input } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';

/**
 * Date field renderer.
 */
@Component({
	selector: 'mcms-date-field-renderer',
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
				[type]="inputType()"
				[value]="dateValue()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="fieldErrors()"
				(valueChange)="onValueChange($event)"
			/>
		</mcms-form-field>
	`,
})
export class DateFieldRenderer {
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

	/** Input type (date or datetime-local) */
	readonly inputType = computed((): 'text' => {
		// HTML5 date input type isn't in InputType union, use text for now
		// The browser will still render date picker for type="date"
		return 'text';
	});

	/** Formatted date value for input */
	readonly dateValue = computed(() => {
		const val = this.value();
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
		if (!value) {
			this.fieldChange.emit({
				path: this.path(),
				value: null,
			});
			return;
		}

		// Convert to ISO string
		try {
			const date = new Date(value);
			this.fieldChange.emit({
				path: this.path(),
				value: date.toISOString(),
			});
		} catch {
			this.fieldChange.emit({
				path: this.path(),
				value: null,
			});
		}
	}
}

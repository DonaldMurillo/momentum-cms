/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow Field union to NumberField after type guard */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Input } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import { humanizeFieldName } from '@momentum-cms/core';
import type { Field, NumberField } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';

/**
 * Number field renderer.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 *
 * NOTE: No clamping is applied on value change. Signal forms validators
 * handle min/max constraint errors. HTML min/max/step attrs still set
 * for browser-native spinner behavior.
 */
@Component({
	selector: 'mcms-number-field-renderer',
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
				type="number"
				[value]="stringValue()"
				[placeholder]="placeholder()"
				[disabled]="isDisabled()"
				[errors]="touchedErrors()"
				[min]="minValue()"
				[max]="maxValue()"
				[step]="stepValue()"
				(valueChange)="onValueChange($event)"
				(blurred)="onBlur()"
			/>
			@if (rangeHint()) {
				<p class="mt-1 text-xs text-muted-foreground">{{ rangeHint() }}</p>
			}
		</mcms-form-field>
	`,
})
export class NumberFieldRenderer {
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

	/** String value from FieldState */
	readonly stringValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		return val === null || val === undefined ? '' : String(val);
	});

	/** Min constraint from field definition */
	readonly minValue = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'number' ? (f as NumberField).min : undefined;
	});

	/** Max constraint from field definition */
	readonly maxValue = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'number' ? (f as NumberField).max : undefined;
	});

	/** Step constraint from field definition */
	readonly stepValue = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'number' ? (f as NumberField).step : undefined;
	});

	/** Range hint text based on min/max/step constraints */
	readonly rangeHint = computed((): string => {
		const f = this.field();
		if (f.type !== 'number') return '';
		const nf = f as NumberField;
		const parts: string[] = [];
		if (nf.min !== undefined && nf.max !== undefined) {
			parts.push(`${nf.min} - ${nf.max}`);
		} else if (nf.min !== undefined) {
			parts.push(`Min: ${nf.min}`);
		} else if (nf.max !== undefined) {
			parts.push(`Max: ${nf.max}`);
		}
		if (nf.step !== undefined) {
			parts.push(`Step: ${nf.step}`);
		}
		return parts.join(' | ');
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	/**
	 * Handle value change from input.
	 * No clamping — let signal forms validators show min/max errors.
	 */
	onValueChange(value: string): void {
		const state = this.nodeState();
		if (!state) return;
		const numValue = value === '' ? null : Number(value);
		state.value.set(numValue === null || Number.isNaN(numValue) ? null : numValue);
	}

	/**
	 * Handle blur from input.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
	}
}

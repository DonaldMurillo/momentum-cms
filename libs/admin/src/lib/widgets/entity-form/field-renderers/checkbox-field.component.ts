import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { McmsFormField, Checkbox } from '@momentumcms/ui';
import type { ValidationError } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';

/**
 * Checkbox field renderer.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-checkbox-field-renderer',
	imports: [McmsFormField, Checkbox],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-form-field [id]="fieldId()" [hasLabel]="false" [errors]="touchedErrors()">
			<mcms-checkbox
				[id]="fieldId()"
				[value]="boolValue()"
				[disabled]="isDisabled()"
				[errors]="touchedErrors()"
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

	/** Field description */
	readonly description = computed(() => this.field().description || '');

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Boolean value from FieldState */
	readonly boolValue = computed(() => {
		const state = this.nodeState();
		if (!state) return false;
		const val = state.value();
		return val === true || val === 'true';
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	/**
	 * Handle value change from checkbox.
	 * Marks touched immediately since checkboxes don't have a native blur flow.
	 */
	onValueChange(value: boolean): void {
		const state = this.nodeState();
		if (!state) return;
		state.value.set(value);
		state.markAsTouched();
	}
}

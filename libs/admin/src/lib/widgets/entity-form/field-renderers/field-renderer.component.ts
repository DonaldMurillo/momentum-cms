import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Field, CollectionConfig } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { TextFieldRenderer } from './text-field.component';
import { NumberFieldRenderer } from './number-field.component';
import { SelectFieldRenderer } from './select-field.component';
import { CheckboxFieldRenderer } from './checkbox-field.component';
import { DateFieldRenderer } from './date-field.component';
import { UploadFieldRenderer } from './upload-field.component';
import { GroupFieldRenderer } from './group-field.component';
import { ArrayFieldRenderer } from './array-field.component';
import { BlocksFieldRenderer } from './blocks-field.component';
import { RelationshipFieldRenderer } from './relationship-field.component';
import { RichTextFieldRenderer } from './rich-text-field.component';
import { TabsFieldRenderer } from './tabs-field.component';
import { CollapsibleFieldRenderer } from './collapsible-field.component';
import { RowFieldRenderer } from './row-field.component';

/**
 * Dynamic field renderer that switches based on field type.
 *
 * @example
 * ```html
 * <mcms-field-renderer
 *   [field]="field"
 *   [value]="value"
 *   [mode]="mode"
 *   [path]="field.name"
 *   [error]="error"
 *   (fieldChange)="onFieldChange($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-field-renderer',
	imports: [
		TextFieldRenderer,
		NumberFieldRenderer,
		SelectFieldRenderer,
		CheckboxFieldRenderer,
		DateFieldRenderer,
		UploadFieldRenderer,
		GroupFieldRenderer,
		ArrayFieldRenderer,
		BlocksFieldRenderer,
		RelationshipFieldRenderer,
		RichTextFieldRenderer,
		TabsFieldRenderer,
		CollapsibleFieldRenderer,
		RowFieldRenderer,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@switch (fieldType()) {
			@case ('text') {
				<mcms-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('textarea') {
				<mcms-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('richText') {
				<mcms-rich-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('email') {
				<mcms-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('slug') {
				<mcms-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('number') {
				<mcms-number-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('select') {
				<mcms-select-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('checkbox') {
				<mcms-checkbox-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('date') {
				<mcms-date-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('upload') {
				<mcms-upload-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('group') {
				<mcms-group-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('array') {
				<mcms-array-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('blocks') {
				<mcms-blocks-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('relationship') {
				<mcms-relationship-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('tabs') {
				<mcms-tabs-field-renderer
					[field]="field()"
					[formData]="formData()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('collapsible') {
				<mcms-collapsible-field-renderer
					[field]="field()"
					[formData]="formData()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@case ('row') {
				<mcms-row-field-renderer
					[field]="field()"
					[formData]="formData()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
			@default {
				<!-- Unsupported field type, render as text for now -->
				<mcms-text-field-renderer
					[field]="field()"
					[value]="value()"
					[mode]="mode()"
					[path]="path()"
					[error]="error()"
					(fieldChange)="fieldChange.emit($event)"
				/>
			}
		}
	`,
})
export class FieldRenderer {
	/** Field definition */
	readonly field = input.required<Field>();

	/** Current value */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Collection configuration (for relationship fields) */
	readonly collection = input<CollectionConfig | undefined>(undefined);

	/** Full form data (for conditional fields) */
	readonly formData = input<Record<string, unknown>>({});

	/** Field path (for nested fields) */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Field type for template switching */
	readonly fieldType = computed(() => this.field().type);
}

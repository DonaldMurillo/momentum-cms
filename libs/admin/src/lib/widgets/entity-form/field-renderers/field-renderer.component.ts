import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
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
 * Uses Angular Signal Forms bridge pattern: each renderer receives
 * its formNode (FieldTree) and reads/writes values via FieldState.
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
				<mcms-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('textarea') {
				<mcms-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('richText') {
				<mcms-rich-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('email') {
				<mcms-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('slug') {
				<mcms-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('number') {
				<mcms-number-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('select') {
				<mcms-select-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('checkbox') {
				<mcms-checkbox-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('date') {
				<mcms-date-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('upload') {
				<mcms-upload-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
			@case ('group') {
				<mcms-group-field-renderer
					[field]="field()"
					[formNode]="formNode()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('array') {
				<mcms-array-field-renderer
					[field]="field()"
					[formNode]="formNode()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('blocks') {
				<mcms-blocks-field-renderer
					[field]="field()"
					[formNode]="formNode()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('relationship') {
				<mcms-relationship-field-renderer
					[field]="field()"
					[formNode]="formNode()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('tabs') {
				<mcms-tabs-field-renderer
					[field]="field()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('collapsible') {
				<mcms-collapsible-field-renderer
					[field]="field()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@case ('row') {
				<mcms-row-field-renderer
					[field]="field()"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="path()"
				/>
			}
			@default {
				<mcms-text-field-renderer [field]="field()" [formNode]="formNode()" [mode]="mode()" [path]="path()" />
			}
		}
	`,
})
export class FieldRenderer {
	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree (for layout fields that look up child nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (for nested fields) */
	readonly path = input.required<string>();

	/** Field type for template switching */
	readonly fieldType = computed(() => this.field().type);
}

import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getSubNode } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Row layout field renderer.
 *
 * Displays child fields side-by-side in a horizontal row.
 * This is a layout-only field; it does not store data itself.
 * Child field FieldTree nodes are looked up from the root formTree
 * using flat field names.
 */
@Component({
	selector: 'mcms-row-field-renderer',
	imports: [forwardRef(() => FieldRenderer)],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (label()) {
			<h3 class="text-sm font-medium text-foreground mb-3">{{ label() }}</h3>
		}
		@if (description()) {
			<p class="text-sm text-muted-foreground mb-3">{{ description() }}</p>
		}
		<div class="grid gap-4" [style.grid-template-columns]="gridColumns()">
			@for (subField of subFields(); track subField.name) {
				<mcms-field-renderer
					[field]="subField"
					[formNode]="getChildFormNode(subField.name)"
					[formTree]="formTree()"
					[formModel]="formModel()"
					[mode]="mode()"
					[path]="subField.name"
				/>
			}
		</div>
	`,
})
export class RowFieldRenderer {
	/** Field definition (must be a RowField) */
	readonly field = input.required<Field>();

	/** Root signal forms FieldTree (for looking up child field nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (unused for layout fields, kept for interface consistency) */
	readonly path = input.required<string>();

	/** Computed label */
	readonly label = computed(() => this.field().label || '');

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Child fields */
	readonly subFields = computed((): Field[] => {
		const f = this.field();
		if (f.type === 'row') {
			return f.fields.filter((sf) => !sf.admin?.hidden);
		}
		return [];
	});

	/** CSS grid columns: equal width for each child */
	readonly gridColumns = computed((): string => {
		const count = this.subFields().length;
		return `repeat(${count}, 1fr)`;
	});

	/** Get a FieldTree sub-node for a child field (flat path from root tree) */
	getChildFormNode(fieldName: string): unknown {
		return getSubNode(this.formTree(), fieldName);
	}
}

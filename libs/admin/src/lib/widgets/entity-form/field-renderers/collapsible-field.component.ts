import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, input, signal } from '@angular/core';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@momentum-cms/ui';
import { humanizeFieldName } from '@momentum-cms/core';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getSubNode } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Collapsible layout field renderer.
 *
 * Wraps child fields in an expandable/collapsible accordion section.
 * This is a layout-only field; it does not store data itself.
 * Child field FieldTree nodes are looked up from the root formTree
 * using flat field names.
 */
@Component({
	selector: 'mcms-collapsible-field-renderer',
	imports: [Accordion, AccordionItem, AccordionTrigger, AccordionContent, forwardRef(() => FieldRenderer)],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-accordion>
			<mcms-accordion-item>
				<mcms-accordion-trigger [panelId]="panelId()" [(expanded)]="isExpanded">
					{{ label() }}
				</mcms-accordion-trigger>
				<mcms-accordion-content [panelId]="panelId()">
					@if (description()) {
						<p class="text-sm text-muted-foreground mb-4">{{ description() }}</p>
					}
					<div class="space-y-4 py-4">
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
				</mcms-accordion-content>
			</mcms-accordion-item>
		</mcms-accordion>
	`,
})
export class CollapsibleFieldRenderer {
	/** Field definition (must be a CollapsibleField) */
	readonly field = input.required<Field>();

	/** Root signal forms FieldTree (for looking up child field nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (unused for layout fields, kept for interface consistency) */
	readonly path = input.required<string>();

	/** Whether the accordion is expanded */
	readonly isExpanded = signal(false);

	/** Unique panel ID for accordion aria linkage */
	readonly panelId = computed(() => `collapsible-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Child fields */
	readonly subFields = computed((): Field[] => {
		const f = this.field();
		if (f.type === 'collapsible') {
			return f.fields.filter((sf) => !sf.admin?.hidden);
		}
		return [];
	});

	constructor() {
		// Set initial expanded state from field config once input is available
		effect(() => {
			const f = this.field();
			if (f.type === 'collapsible' && f.defaultOpen) {
				this.isExpanded.set(true);
			}
		});
	}

	/** Get a FieldTree sub-node for a child field (flat path from root tree) */
	getChildFormNode(fieldName: string): unknown {
		return getSubNode(this.formTree(), fieldName);
	}
}

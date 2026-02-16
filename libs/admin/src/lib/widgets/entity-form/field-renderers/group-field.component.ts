import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	forwardRef,
	input,
	signal,
} from '@angular/core';
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getSubNode } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Group field renderer.
 *
 * Renders a group of sub-fields inside a bordered card section.
 * When `admin.collapsible` is true, renders as an accordion instead.
 * Data container pattern: passes sub-field FieldTree nodes via getSubNode().
 */
@Component({
	selector: 'mcms-group-field-renderer',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Accordion,
		AccordionItem,
		AccordionTrigger,
		AccordionContent,
		forwardRef(() => FieldRenderer),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (collapsible()) {
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
									[formNode]="getSubFormNode(subField.name)"
									[formTree]="formTree()"
									[formModel]="formModel()"
									[mode]="mode()"
									[path]="getSubFieldPath(subField.name)"
								/>
							}
						</div>
					</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
		} @else {
			<mcms-card>
				<mcms-card-header>
					<mcms-card-title>{{ label() }}</mcms-card-title>
					@if (description()) {
						<p class="text-sm text-muted-foreground">{{ description() }}</p>
					}
				</mcms-card-header>
				<mcms-card-content>
					<div class="space-y-4">
						@for (subField of subFields(); track subField.name) {
							<mcms-field-renderer
								[field]="subField"
								[formNode]="getSubFormNode(subField.name)"
								[formTree]="formTree()"
								[formModel]="formModel()"
								[mode]="mode()"
								[path]="getSubFieldPath(subField.name)"
							/>
						}
					</div>
				</mcms-card-content>
			</mcms-card>
		}
	`,
})
export class GroupFieldRenderer {
	/** Field definition (must be a GroupField) */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this group */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree (for layout fields that look up child nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (e.g., "seo") */
	readonly path = input.required<string>();

	/** Whether the accordion is expanded (only used in collapsible mode) */
	readonly isExpanded = signal(false);

	/** Whether this group should render as collapsible accordion */
	readonly collapsible = computed(() => !!this.field().admin?.collapsible);

	/** Unique panel ID for accordion aria linkage */
	readonly panelId = computed(() => `group-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Sub-fields from the group definition */
	readonly subFields = computed((): Field[] => {
		const f = this.field();
		if (f.type === 'group') {
			return f.fields.filter((sf) => !sf.admin?.hidden);
		}
		return [];
	});

	constructor() {
		effect(() => {
			if (this.collapsible() && this.field().admin?.defaultOpen) {
				this.isExpanded.set(true);
			}
		});
	}

	/** Get a FieldTree sub-node for a sub-field */
	getSubFormNode(subFieldName: string): unknown {
		return getSubNode(this.formNode(), subFieldName);
	}

	/** Get the full path for a sub-field (e.g., "seo.metaTitle") */
	getSubFieldPath(subFieldName: string): string {
		return `${this.path()}.${subFieldName}`;
	}
}

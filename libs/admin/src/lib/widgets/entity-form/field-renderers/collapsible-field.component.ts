import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, input, output, signal } from '@angular/core';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Collapsible layout field renderer.
 *
 * Wraps child fields in an expandable/collapsible accordion section.
 * This is a layout-only field; it does not store data itself.
 * Child field values use flat paths (e.g., "apiKey", not "advanced.apiKey").
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
								[value]="getFieldValue(subField.name)"
								[mode]="mode()"
								[formData]="formData()"
								[path]="subField.name"
								[error]="undefined"
								(fieldChange)="fieldChange.emit($event)"
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

	/** Full form data for extracting child field values */
	readonly formData = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (unused for layout fields, kept for interface consistency) */
	readonly path = input.required<string>();

	/** Field error (unused for layout fields) */
	readonly error = input<string | undefined>(undefined);

	/** Field change event - forwarded from sub-field renderers */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Whether the accordion is expanded */
	readonly isExpanded = signal(false);

	/** Unique panel ID for accordion aria linkage */
	readonly panelId = computed(() => `collapsible-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

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

	/** Get a field value from formData (flat path) */
	getFieldValue(fieldName: string): unknown {
		return this.formData()[fieldName] ?? null;
	}
}

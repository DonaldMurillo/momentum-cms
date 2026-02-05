import { ChangeDetectionStrategy, Component, computed, forwardRef, input, output, signal } from '@angular/core';
import {
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from '@momentum-cms/ui';
import type { Field, TabConfig } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Tabs layout field renderer.
 *
 * Organizes child fields into tabbed sections. This is a layout-only field;
 * it does not store data itself. Child field values are read from and
 * written to formData using flat paths (e.g., "metaTitle", not "tabs.metaTitle").
 */
@Component({
	selector: 'mcms-tabs-field-renderer',
	imports: [Tabs, TabsList, TabsTrigger, TabsContent, forwardRef(() => FieldRenderer)],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (label()) {
			<h3 class="text-sm font-medium text-foreground mb-3">{{ label() }}</h3>
		}
		@if (description()) {
			<p class="text-sm text-muted-foreground mb-3">{{ description() }}</p>
		}
		<mcms-tabs>
			<mcms-tabs-list [(selectedTab)]="selectedTab">
				@for (tab of tabConfigs(); track tab.label) {
					<mcms-tabs-trigger [value]="tab.label">{{ tab.label }}</mcms-tabs-trigger>
				}
			</mcms-tabs-list>
			@for (tab of tabConfigs(); track tab.label) {
				<mcms-tabs-content [value]="tab.label">
					@if (tab.description) {
						<p class="text-sm text-muted-foreground mb-4">{{ tab.description }}</p>
					}
					<div class="space-y-4 pt-4">
						@for (subField of getTabFields(tab); track subField.name) {
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
				</mcms-tabs-content>
			}
		</mcms-tabs>
	`,
})
export class TabsFieldRenderer {
	/** Field definition (must be a TabsField) */
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

	/** Currently selected tab */
	readonly selectedTab = signal('');

	/** Computed label */
	readonly label = computed(() => this.field().label || '');

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Tab configurations from the field */
	readonly tabConfigs = computed((): TabConfig[] => {
		const f = this.field();
		if (f.type === 'tabs') {
			return f.tabs;
		}
		return [];
	});

	/** Get visible fields for a tab */
	getTabFields(tab: TabConfig): Field[] {
		return tab.fields.filter((f) => !f.admin?.hidden);
	}

	/** Get a field value from formData (flat path) */
	getFieldValue(fieldName: string): unknown {
		return this.formData()[fieldName] ?? null;
	}
}

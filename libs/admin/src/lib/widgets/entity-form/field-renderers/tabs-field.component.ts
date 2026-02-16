import {
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	input,
	signal,
} from '@angular/core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@momentumcms/ui';
import type { Field, TabConfig } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getSubNode } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Tabs layout field renderer.
 *
 * Organizes child fields into tabbed sections. This is a layout-only field;
 * it does not store data itself. Child field FieldTree nodes are looked up
 * from the root formTree using flat field names.
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
								[formNode]="getChildFormNode(subField.name)"
								[formTree]="formTree()"
								[formModel]="formModel()"
								[mode]="mode()"
								[path]="subField.name"
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

	/** Root signal forms FieldTree (for looking up child field nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (unused for layout fields, kept for interface consistency) */
	readonly path = input.required<string>();

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

	/** Get a FieldTree sub-node for a child field (flat path from root tree) */
	getChildFormNode(fieldName: string): unknown {
		return getSubNode(this.formTree(), fieldName);
	}
}

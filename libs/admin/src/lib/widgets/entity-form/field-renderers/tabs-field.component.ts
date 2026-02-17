import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
	untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@momentumcms/ui';
import type { Field, TabConfig } from '@momentumcms/core';
import { isNamedTab } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getSubNode } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Tabs layout field renderer.
 *
 * Organizes child fields into tabbed sections. This is a layout-only field;
 * it does not store data itself. Child field FieldTree nodes are looked up
 * from the root formTree using flat field names.
 *
 * The selected tab is persisted as a URL query parameter (keyed by field name)
 * so it survives page refreshes.
 */
@Component({
	selector: 'mcms-tabs-field-renderer',
	imports: [Tabs, TabsList, TabsTrigger, TabsContent, FieldRenderer],
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
								[formNode]="getChildFormNode(tab, subField.name)"
								[formTree]="formTree()"
								[formModel]="formModel()"
								[mode]="mode()"
								[path]="getFieldPath(tab, subField.name)"
							/>
						}
					</div>
				</mcms-tabs-content>
			}
		</mcms-tabs>
	`,
})
export class TabsFieldRenderer {
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

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

	/** Currently selected tab — defaults to first tab or URL query param */
	readonly selectedTab = signal('');

	/** Skips URL sync for the initial tab selection (default or query param restore) */
	private skipNextSync = true;

	constructor() {
		// Initialize selected tab: prefer query param, then fall back to first tab
		effect(() => {
			const configs = this.tabConfigs();
			if (this.selectedTab() === '' && configs.length > 0) {
				const fieldName = untracked(() => this.field().name);
				const queryTab = this.route.snapshot.queryParams[fieldName];
				const tabLabels = new Set(configs.map((t) => t.label));

				this.skipNextSync = true;
				if (typeof queryTab === 'string' && tabLabels.has(queryTab)) {
					this.selectedTab.set(queryTab);
				} else {
					this.selectedTab.set(configs[0].label);
				}
			}
		});

		// Sync tab changes to URL query params (skip initial selection)
		effect(() => {
			const tab = this.selectedTab();
			const fieldName = this.field().name;
			if (tab === '') return;

			if (this.skipNextSync) {
				this.skipNextSync = false;
				return;
			}

			this.router.navigate([], {
				queryParams: { [fieldName]: tab },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			});
		});
	}

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

	/**
	 * Get a FieldTree sub-node for a child field.
	 * Named tabs: look up the tab's nested node, then the field within it.
	 * Unnamed tabs: flat lookup from root tree (current behavior).
	 */
	getChildFormNode(tab: TabConfig, fieldName: string): unknown {
		if (isNamedTab(tab)) {
			const tabNode = getSubNode(this.formTree(), tab.name);
			return getSubNode(tabNode, fieldName);
		}
		return getSubNode(this.formTree(), fieldName);
	}

	/**
	 * Get the field path for a child field within a tab.
	 * Named tabs: returns nested path (e.g., 'seo.metaTitle').
	 * Unnamed tabs: returns flat field name (e.g., 'title').
	 */
	getFieldPath(tab: TabConfig, fieldName: string): string {
		if (isNamedTab(tab)) {
			return `${tab.name}.${fieldName}`;
		}
		return fieldName;
	}
}

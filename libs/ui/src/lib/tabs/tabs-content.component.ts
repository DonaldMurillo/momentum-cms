import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TabPanel } from '@angular/aria/tabs';

/**
 * Tab content panel.
 *
 * @example
 * ```html
 * <mcms-tabs-content value="tab1">
 *   <p>Content for tab 1</p>
 * </mcms-tabs-content>
 * ```
 */
@Component({
	selector: 'mcms-tabs-content',
	hostDirectives: [
		{
			directive: TabPanel,
			inputs: ['value'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		'[hidden]': '!tabPanel.visible()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsContent {
	readonly tabPanel = inject(TabPanel);

	/** Unique value identifying this panel (must match a tab's value). */
	readonly value = input.required<string>();

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${this.class()}`.trim();
	});
}

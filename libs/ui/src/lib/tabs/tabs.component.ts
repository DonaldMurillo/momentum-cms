import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tabs as NgTabs } from '@angular/aria/tabs';

/**
 * Tabs container component.
 *
 * @example
 * ```html
 * <mcms-tabs>
 *   <mcms-tabs-list [(selectedTab)]="selectedTab">
 *     <mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
 *     <mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
 *   </mcms-tabs-list>
 *   <mcms-tabs-content value="tab1">Content 1</mcms-tabs-content>
 *   <mcms-tabs-content value="tab2">Content 2</mcms-tabs-content>
 * </mcms-tabs>
 * ```
 */
@Component({
	selector: 'mcms-tabs',
	hostDirectives: [NgTabs],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `block ${this.class()}`.trim();
	});
}

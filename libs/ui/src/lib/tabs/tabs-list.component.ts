import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TabList } from '@angular/aria/tabs';
import type { TabsOrientation, TabsSelectionMode } from './tabs.types';

/**
 * Tabs list container for tab triggers.
 *
 * @example
 * ```html
 * <mcms-tabs-list [(selectedTab)]="selectedTab" orientation="horizontal">
 *   <mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
 *   <mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
 * </mcms-tabs-list>
 * ```
 */
@Component({
	selector: 'mcms-tabs-list',
	hostDirectives: [
		{
			directive: TabList,
			inputs: ['orientation', 'selectionMode', 'selectedTab', 'disabled', 'wrap'],
			outputs: ['selectedTabChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsList {
	/** Orientation of the tab list. */
	readonly orientation = input<TabsOrientation>('horizontal');

	/** Selection mode: 'follow' auto-selects on focus, 'explicit' requires Enter/Space. */
	readonly selectionMode = input<TabsSelectionMode>('follow');

	/** The currently selected tab value. */
	readonly selectedTab = model<string>();

	/** Whether the tab list is disabled. */
	readonly disabled = input(false);

	/** Whether navigation should wrap at edges. */
	readonly wrap = input(true);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base =
			'inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground';
		const orientationClasses = this.orientation() === 'vertical' ? 'flex-col h-auto' : 'h-9';

		return `${base} ${orientationClasses} ${this.class()}`.trim();
	});
}

import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { TabList } from '@angular/aria/tabs';

@Component({
	selector: 'hdl-tab-list',
	hostDirectives: [
		{
			directive: TabList,
			inputs: ['orientation', 'selectionMode', 'selectedTab', 'disabled', 'wrap'],
			outputs: ['selectedTabChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTabList {
	readonly tabList = inject(TabList);
	readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
	readonly selectionMode = input<'follow' | 'explicit'>('follow');
	readonly selectedTab = model<string>();
	readonly disabled = input(false);
	readonly wrap = input(true);
}

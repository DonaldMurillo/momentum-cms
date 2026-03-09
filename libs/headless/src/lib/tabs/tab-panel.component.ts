import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TabPanel } from '@angular/aria/tabs';

@Component({
	selector: 'hdl-tab-panel',
	hostDirectives: [
		{
			directive: TabPanel,
			inputs: ['value'],
		},
	],
	host: {
		'[attr.data-slot]': '"tab-panel"',
		'[attr.data-state]': 'tabPanel.visible() ? "visible" : "hidden"',
		'[hidden]': '!tabPanel.visible()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTabPanel {
	readonly tabPanel = inject(TabPanel);
	readonly value = input.required<string>();
}
